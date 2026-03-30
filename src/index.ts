import { Client, GatewayIntentBits, type Message, type PartialMessage, Partials } from 'discord.js';

import { transformDelete, transformMessage, transformReactionUpdate } from '~/transform';
import { createClient } from '~/modes';
import Logger from '~/logger';
import env from '~/env';

const logger = new Logger('Discord', 'Ingest');

const ingest = await createClient(env.MODE);

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.DirectMessages,
		GatewayIntentBits.GuildMessageReactions,
	],
	partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.once('clientReady', (c) => {
	logger.success(`Logged in as ${c.user.tag}`);
});

client.on('messageCreate', async (message) => {
	try {
		const payload = transformMessage(message);
		if (await ingest.create(payload))
			logger.info(`Sent ingest for new message (${message.id})`);
	} catch (error) {
		logger.error(`Failed to process messageCreate (${message.id}):`, error);
	}
});

client.on('messageUpdate', async (_old, updated) => {
	try {
		if (updated.partial) {
			const fetched = await updated.fetch().catch(() => null);
			if (!fetched) return;
			updated = fetched;
		}

		const payload = transformMessage(updated);
		if (await ingest.update(payload))
			logger.info(`Sent ingest for message update (${updated.id})`);
	} catch (error) {
		logger.error(`Failed to process messageUpdate (${updated.id}):`, error);
	}
});

client.on('messageDelete', async (message) => {
	try {
		const payload = transformDelete(message);
		if (await ingest.remove(payload))
			logger.info(`Sent ingest for message delete (${message.id})`);
	} catch (error) {
		logger.error(`Failed to process messageDelete (${message.id}):`, error);
	}
});

async function handleReactionChange(reaction: { message: Message | PartialMessage }) {
	try {
		let message: Message;
		if (reaction.message.partial) {
			const fetched = await reaction.message.fetch().catch(() => null);
			if (!fetched) return;
			message = fetched;
		} else {
			message = reaction.message;
		}

		const payload = transformReactionUpdate(message, message.reactions.cache);
		if (await ingest.updateReactions(payload))
			logger.info(`Sent ingest for reaction update (${message.id})`);
	} catch (error) {
		logger.error(`Failed to process reaction change (${reaction.message.id}):`, error);
	}
}

client.on('messageReactionAdd', (reaction) => handleReactionChange(reaction));
client.on('messageReactionRemove', (reaction) => handleReactionChange(reaction));
client.on('messageReactionRemoveEmoji', (reaction) => handleReactionChange(reaction));

client.on('messageReactionRemoveAll', async (message) => {
	try {
		const payload = transformDelete(message);
		if (await ingest.clearReactions(payload))
			logger.info(`Sent ingest for remove all reactions (${message.id})`);
	} catch (error) {
		logger.error(`Failed to process messageReactionRemoveAll (${message.id}):`, error);
	}
});

process.on('SIGINT', async () => {
	await ingest.close();
	client.destroy();
	process.exit(0);
});

process.on('SIGTERM', async () => {
	await ingest.close();
	client.destroy();
	process.exit(0);
});

client.login(env.DISCORD_TOKEN);
