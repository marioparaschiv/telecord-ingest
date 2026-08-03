import {
	Client,
	GatewayDispatchEvents,
	type GatewayDispatchPayload,
	GatewayIntentBits,
} from 'discord.js';

import type { IngestClient } from '~/modes';
import { createClient } from '~/modes';
import Logger from '~/logger';
import env from '~/env';

const logger = new Logger('Discord', 'Ingest');

const ingest = await createClient(env.MODE);

type Event = GatewayDispatchPayload['t'];

type IngestMethod = keyof Pick<
	IngestClient,
	'create' | 'update' | 'remove' | 'updateReactions' | 'clearReactions'
>;

type Route = {
	send: IngestMethod;
	label: string;
};

const routes: Partial<Record<Event, Route>> = {
	[GatewayDispatchEvents.MessageCreate]: { send: 'create', label: 'message created' },
	[GatewayDispatchEvents.MessageUpdate]: { send: 'update', label: 'message edited' },
	[GatewayDispatchEvents.MessageDelete]: { send: 'remove', label: 'message deleted' },
	[GatewayDispatchEvents.MessageReactionAdd]: {
		send: 'updateReactions',
		label: 'reaction added',
	},
	[GatewayDispatchEvents.MessageReactionRemove]: {
		send: 'updateReactions',
		label: 'reaction removed',
	},
	[GatewayDispatchEvents.MessageReactionRemoveEmoji]: {
		send: 'updateReactions',
		label: 'reaction cleared',
	},
	[GatewayDispatchEvents.MessageReactionRemoveAll]: {
		send: 'clearReactions',
		label: 'reactions cleared',
	},
};

function getMessageId(data: GatewayDispatchPayload['d']): string {
	if ('id' in data && data.id) {
		return data.id;
	}

	if ('message_id' in data && data.message_id) {
		return data.message_id;
	}

		return 'unknown';
}

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.DirectMessages,
		GatewayIntentBits.GuildMessageReactions,
	],
});

client.once('clientReady', (c) => {
	logger.success(`Logged in as ${c.user.tag}`);
});

client.on('raw', async (packet: GatewayDispatchPayload) => {
	const route = routes[packet.t];
	if (!route) return;

	try {
		if (await ingest[route.send](packet.d)) {
			logger.info(`${route.label} (${getMessageId(packet.d)})`);
		}
	} catch (error) {
		logger.error(`Failed to process ${packet.t}:`, error);
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
