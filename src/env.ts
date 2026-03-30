type Mode = 'http' | 'ws';

type Env = {
	DISCORD_TOKEN: string;
	API_KEY: string;
	BASE_URL: string;
	WS_URL: string;
	MODE: Mode;
};

function validateEnv(): Env {
	const required = ['DISCORD_TOKEN', 'API_KEY'] as const;
	const missing = required.filter((k) => !process.env[k]);

	if (missing.length) {
		throw new Error(`Missing environment variables: ${missing.join(', ')}`);
	}

	const mode = (process.env.MODE ?? 'http') as Mode;
	if (mode !== 'http' && mode !== 'ws') {
		throw new Error(`Invalid MODE: ${mode}. Must be 'http' or 'ws'.`);
	}

	const baseUrl = process.env.BASE_URL ?? 'https://beta.telecord.app/api';

	return {
		DISCORD_TOKEN: process.env.DISCORD_TOKEN!,
		API_KEY: process.env.API_KEY!,
		BASE_URL: baseUrl,
		WS_URL: process.env.WS_URL ?? 'ws://localhost:9998',
		MODE: mode,
	};
}

const env = validateEnv();

export type { Mode };
export default env;
