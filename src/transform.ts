import type { DMChannel, Guild, Message, MessageReaction, PartialMessage, User } from 'discord.js';
import { ChannelType } from 'discord.js';

type IngestUser = {
	id: string;
	username: string;
	global_name?: string | null;
	avatar?: string | null;
	bot?: boolean;
};

type IngestChannel = {
	id: string;
	type: number;
	name?: string | null;
	guild_id?: string;
	recipients?: IngestUser[];
	icon?: string | null;
};

type IngestGuild = {
	id: string;
	name: string;
	icon?: string | null;
};

type IngestAttachment = {
	id: string;
	url: string;
	filename: string;
	content_type?: string | null;
	width?: number | null;
	height?: number | null;
};

type IngestStickerItem = {
	id: string;
	name: string;
	format_type: number;
};

type IngestRole = {
	id: string;
	name: string;
	color: number;
};

type IngestChannelMention = {
	id: string;
	name: string;
	guild_id?: string;
	guild_name?: string;
};

type IngestMessageReference = {
	message_id?: string;
	channel_id?: string;
	guild_id?: string;
};

type IngestPayload = {
	id: string;
	content: string;
	timestamp: string;
	edited_timestamp?: string | null;
	author: IngestUser;
	channel_id: string;
	channel: IngestChannel;
	guild?: IngestGuild | null;
	attachments: IngestAttachment[];
	embeds: unknown[];
	reactions?: Array<{
		count: number;
		emoji: { id?: string | null; name: string | null; animated?: boolean };
	}>;
	mentions: IngestUser[];
	mention_roles: IngestRole[];
	mention_channels: IngestChannelMention[];
	mention_everyone: boolean;
	stickers?: IngestStickerItem[];
	message_reference?: IngestMessageReference | null;
};

type IngestReaction = {
	count: number;
	emoji: { id?: string | null; name: string | null; animated?: boolean };
};

type IngestIdentifier = {
	id: string;
	channel_id: string;
	channel: IngestChannel;
	guild?: IngestGuild | null;
};

type IngestReactionPayload = IngestIdentifier & {
	reactions: IngestReaction[];
};

function transformUser(user: User): IngestUser {
	return {
		id: user.id,
		username: user.username,
		global_name: user.globalName,
		avatar: user.avatar,
		bot: user.bot,
	};
}

function transformChannel(message: Message): IngestChannel {
	const channel = message.channel;
	const base: IngestChannel = {
		id: channel.id,
		type: channel.type,
		name: 'name' in channel ? channel.name : null,
		guild_id: message.guildId ?? undefined,
	};

	if (channel.type === ChannelType.DM) {
		const dm = channel as DMChannel;
		if (dm.recipient) {
			base.recipients = [transformUser(dm.recipient)];
		}
	}

	if (channel.type === ChannelType.GroupDM && 'icon' in channel) {
		base.icon = (channel as { icon: string | null }).icon;
	}

	return base;
}

function transformGuild(guild: Guild): IngestGuild {
	return {
		id: guild.id,
		name: guild.name,
		icon: guild.icon,
	};
}

export function transformMessage(message: Message): IngestPayload {
	const attachments: IngestAttachment[] = message.attachments.map((a) => ({
		id: a.id,
		url: a.url,
		filename: a.name,
		content_type: a.contentType,
		width: a.width,
		height: a.height,
	}));

	const embeds = message.embeds.map((e) => e.toJSON());

	const reactions = message.reactions.cache.size
		? message.reactions.cache.map((r) => ({
				count: r.count,
				emoji: {
					id: r.emoji.id,
					name: r.emoji.name,
					animated: r.emoji.animated ?? undefined,
				},
			}))
		: [];

	const mentions = message.mentions.users.map((u) => transformUser(u));
	const mentionRoles: IngestRole[] = message.mentions.roles.map((r) => ({
		id: r.id,
		name: r.name,
		color: r.color,
	}));

	const mentionChannels: IngestChannelMention[] = message.mentions.channels.map((c) => ({
		id: c.id,
		name: 'name' in c && c.name ? c.name : c.id,
		...('guild' in c && c.guild ? { guild_id: c.guild.id, guild_name: c.guild.name } : {}),
	}));

	const stickers: IngestStickerItem[] | undefined = message.stickers.size
		? message.stickers.map((s) => ({
				id: s.id,
				name: s.name,
				format_type: s.format,
			}))
		: [];

	const messageReference: IngestMessageReference | null = message.reference
		? {
				message_id: message.reference.messageId ?? undefined,
				channel_id: message.reference.channelId ?? undefined,
				guild_id: message.reference.guildId ?? undefined,
			}
		: null;

	return {
		id: message.id,
		content: message.content,
		timestamp: message.createdAt.toISOString(),
		edited_timestamp: message.editedAt?.toISOString() ?? null,
		author: transformUser(message.author),
		channel_id: message.channelId,
		channel: transformChannel(message),
		guild: message.guild ? transformGuild(message.guild) : null,
		attachments,
		embeds,
		reactions,
		mentions,
		mention_roles: mentionRoles,
		mention_channels: mentionChannels,
		mention_everyone: message.mentions.everyone,
		stickers,
		message_reference: messageReference,
	};
}

export function transformDelete(message: Message | PartialMessage): IngestIdentifier {
	const channel = message.channel;

	return {
		id: message.id,
		channel_id: message.channelId,
		channel: {
			id: message.channelId,
			type: channel.type,
			name: 'name' in channel ? channel.name : null,
			guild_id: message.guildId ?? undefined,
		},
		guild: message.guild
			? { id: message.guild.id, name: message.guild.name, icon: message.guild.icon }
			: message.guildId
				? { id: message.guildId, name: '', icon: null }
				: null,
	};
}

export function transformReactionUpdate(
	message: Message,
	reactions: ReadonlyMap<string, MessageReaction>,
): IngestReactionPayload {
	return {
		...transformDelete(message),
		reactions: [...reactions.values()].map((r) => ({
			count: r.count,
			emoji: {
				id: r.emoji.id,
				name: r.emoji.name,
				animated: r.emoji.animated ?? undefined,
			},
		})),
	};
}
