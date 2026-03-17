type Env = {
	DISCORD_TOKEN: string;
	API_KEY: string;
	BASE_URL: string;
};

function validateEnv(): Env {
	const required = ['DISCORD_TOKEN', 'API_KEY'] as const;
	const missing = required.filter((k) => !process.env[k]);

	if (missing.length) {
		throw new Error(`Missing environment variables: ${missing.join(', ')}`);
	}

	return {
		DISCORD_TOKEN: process.env.DISCORD_TOKEN!,
		API_KEY: process.env.API_KEY!,
		BASE_URL: process.env.BASE_URL ?? 'https://beta.telecord.app/api',
	};
}

const env = validateEnv();

export default env;
