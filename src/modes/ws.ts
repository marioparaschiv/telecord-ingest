import { encode, decode } from '@msgpack/msgpack';
import WebSocket from 'ws';

import type { IngestClient } from '~/modes';
import Logger from '~/logger';
import env from '~/env';

const logger = new Logger('Ingest', 'WebSocket');

const Opcode = {
	DISCORD_MESSAGE_CREATE: 'discord.message.create',
	DISCORD_MESSAGE_UPDATE: 'discord.message.update',
	DISCORD_MESSAGE_DELETE: 'discord.message.delete',
	DISCORD_REACTION_UPDATE: 'discord.reaction.update',
	DISCORD_REACTION_CLEAR: 'discord.reaction.clear',
} as const;

type WsMessage = {
	op: string;
	d?: unknown;
	nonce?: string | null;
};

const RECONNECT_DELAY = 500;
const HEARTBEAT_INTERVAL = 30000;

type PendingRequest = {
	resolve: (ok: boolean) => void;
	timeout: ReturnType<typeof setTimeout>;
};

function createWsClient(): Promise<IngestClient> {
	let ws: WebSocket | null = null;
	let heartbeatInterval: ReturnType<typeof setInterval> | undefined;
	let reconnectTimeout: ReturnType<typeof setTimeout> | undefined;
	let closing = false;
	let nonceCounter = 0;
	const pending = new Map<string, PendingRequest>();

	function nextNonce(): string {
		return String(++nonceCounter);
	}

	function handleMessage(data: Buffer) {
		try {
			const message = decode(data) as WsMessage;

			if (message.op === 'ping') {
				ws?.send(encode({ op: 'pong' }));
				return;
			}

			if (message.op === 'ack' || message.op === 'error') {
				const nonce = message.nonce;
				if (nonce && pending.has(nonce)) {
					const request = pending.get(nonce)!;
					clearTimeout(request.timeout);
					pending.delete(nonce);

					if (message.op === 'error') {
						const err = message.d as { code?: string; message?: string } | undefined;
						logger.error(
							`Server error: ${err?.code ?? 'UNKNOWN'} — ${err?.message ?? ''}`,
						);
						request.resolve(false);
					} else {
						request.resolve(true);
					}
				}
				return;
			}
		} catch (error) {
			logger.error('Failed to decode message:', error);
		}
	}

	function connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			const url = `${env.WS_URL}?api_key=${env.API_KEY}`;
			ws = new WebSocket(url);
			ws.binaryType = 'arraybuffer';

			let resolved = false;

			ws.on('open', () => {
				logger.info('Connected');
			});

			ws.on('message', (data: Buffer, isBinary: boolean) => {
				if (!isBinary) return;

				if (!resolved) {
					const message = decode(data) as WsMessage;
					if (message.op === 'ack') {
						resolved = true;
						startHeartbeat();
						resolve();
						return;
					}
				}

				handleMessage(data);
			});

			ws.on('close', (code, reason) => {
				logger.warn(`Disconnected (${code}: ${reason.toString()})`);
				stopHeartbeat();
				rejectPending();

				if (!resolved) {
					resolved = true;
					reject(new Error(`WebSocket closed before connected: ${code}`));
					return;
				}

				if (!closing) {
					logger.info(`Reconnecting in ${RECONNECT_DELAY}ms...`);
					reconnectTimeout = setTimeout(() => {
						connect().catch((err) => {
							logger.error('Reconnect failed:', err);
						});
					}, RECONNECT_DELAY);
				}
			});

			ws.on('error', (error) => {
				logger.error('WebSocket error:', error.message);
				if (!resolved) {
					resolved = true;
					reject(error);
				}
			});
		});
	}

	function startHeartbeat() {
		stopHeartbeat();
		heartbeatInterval = setInterval(() => {
			if (ws?.readyState === WebSocket.OPEN) {
				ws.send(encode({ op: 'pong' }));
			}
		}, HEARTBEAT_INTERVAL);
	}

	function stopHeartbeat() {
		if (heartbeatInterval) {
			clearInterval(heartbeatInterval);
			heartbeatInterval = undefined;
		}
	}

	function rejectPending() {
		for (const [nonce, request] of pending) {
			clearTimeout(request.timeout);
			request.resolve(false);
			pending.delete(nonce);
		}
	}

	function send(op: string, body: unknown): Promise<boolean> {
		return new Promise((resolve) => {
			if (!ws || ws.readyState !== WebSocket.OPEN) {
				logger.warn('Not connected, dropping message');
				resolve(false);
				return;
			}

			const nonce = nextNonce();
			const timeout = setTimeout(() => {
				if (pending.has(nonce)) {
					pending.delete(nonce);
					logger.warn(`Request timed out (nonce: ${nonce})`);
					resolve(false);
				}
			}, 10000);

			pending.set(nonce, { resolve, timeout });

			try {
				ws.send(encode({ op, d: body, nonce }));
				logger.debug(`Sent ${op}`);
			} catch (error) {
				clearTimeout(timeout);
				pending.delete(nonce);
				logger.error(`Send failed:`, error);
				resolve(false);
			}
		});
	}

	return connect().then((): IngestClient => {
		logger.info('Using WebSocket mode');

		return {
			create: (body) => send(Opcode.DISCORD_MESSAGE_CREATE, body),
			update: (body) => send(Opcode.DISCORD_MESSAGE_UPDATE, body),
			remove: (body) => send(Opcode.DISCORD_MESSAGE_DELETE, body),
			updateReactions: (body) => send(Opcode.DISCORD_REACTION_UPDATE, body),
			clearReactions: (body) => send(Opcode.DISCORD_REACTION_CLEAR, body),
			close: async () => {
				closing = true;

				stopHeartbeat();
				rejectPending();

				if (reconnectTimeout) clearTimeout(reconnectTimeout);

				if (ws && ws.readyState === WebSocket.OPEN) {
					ws.close(1000, 'Client closing');
				}

				ws = null;
			},
		};
	});
}

export { createWsClient };
