import type { IngestClient } from '~/modes';
import Logger from '~/logger';
import env from '~/env';

type HttpMethod = 'POST' | 'PATCH' | 'PUT' | 'DELETE';

const logger = new Logger('Ingest', 'HTTP');

async function send(method: HttpMethod, path: string, body: unknown): Promise<boolean> {
	const url = env.BASE_URL + path;

	try {
		const response = await fetch(url, {
			method,
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': env.API_KEY,
			},
			body: JSON.stringify(body),
		});

		logger.debug(`${method} ${url}`);

		if (!response.ok) {
			const text = await response.text();
			logger.error(`${method} failed (${response.status}): ${text}`);
			return false;
		}

		return true;
	} catch (error) {
		logger.error(`${method} request error:`, error);
		return false;
	}
}

function createHttpClient(): IngestClient {
	logger.info('Using HTTP mode');

	return {
		create: (body) => send('POST', '/ingest/discord', body),
		update: (body) => send('PATCH', '/ingest/discord', body),
		remove: (body) => send('DELETE', '/ingest/discord', body),
		updateReactions: (body) => send('PUT', '/ingest/discord/reactions', body),
		clearReactions: (body) => send('DELETE', '/ingest/discord/reactions', body),
		close: async () => {},
	};
}

export { createHttpClient };
