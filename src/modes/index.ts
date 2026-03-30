import type { Mode } from '~/env';

import { createHttpClient } from './http';
import { createWsClient } from './ws';

type IngestClient = {
	create(body: unknown): Promise<boolean>;
	update(body: unknown): Promise<boolean>;
	remove(body: unknown): Promise<boolean>;
	updateReactions(body: unknown): Promise<boolean>;
	clearReactions(body: unknown): Promise<boolean>;
	close(): Promise<void>;
};

async function createClient(mode: Mode): Promise<IngestClient> {
	if (mode === 'ws') return createWsClient();
	return createHttpClient();
}

export type { IngestClient };
export { createClient };
