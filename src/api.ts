import Logger from '~/logger';
import env from '~/env';

type HttpMethod = 'POST' | 'PATCH' | 'PUT' | 'DELETE';

const logger = new Logger('Discord', 'Ingest', 'API');

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

function create(body: unknown): Promise<boolean> {
	return send('POST', '/ingest/discord', body);
}

function update(body: unknown): Promise<boolean> {
	return send('PATCH', '/ingest/discord', body);
}

function remove(body: unknown): Promise<boolean> {
	return send('DELETE', '/ingest/discord', body);
}

function updateReactions(body: unknown): Promise<boolean> {
	return send('PUT', '/ingest/discord/reactions', body);
}

function clearReactions(body: unknown): Promise<boolean> {
	return send('DELETE', '/ingest/discord/reactions', body);
}

const api = { create, update, remove, updateReactions, clearReactions };

export default api;
