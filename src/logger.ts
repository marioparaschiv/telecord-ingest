type Level = 'log' | 'error' | 'success' | 'warn' | 'debug' | 'info';

const levelMethod = {
	log: 'log',
	error: 'error',
	success: 'info',
	warn: 'warn',
	debug: 'debug',
	info: 'info',
} satisfies Record<Level, keyof Console>;

class Logger {
	private caller: string[];

	constructor(...callers: string[]) {
		this.caller = callers;
	}

	log(...args: unknown[]) {
		this._print('log', ...args);
	}

	error(...args: unknown[]) {
		this._print('error', ...args);
	}

	success(...args: unknown[]) {
		this._print('success', ...args);
	}

	warn(...args: unknown[]) {
		this._print('warn', ...args);
	}

	debug(...args: unknown[]) {
		this._print('debug', ...args);
	}

	info(...args: unknown[]) {
		this._print('info', ...args);
	}

	private _print(level: Level, ...args: unknown[]) {
		const now = new Date();
		const timestamp = `[${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}]`;
		const caller = `[${this.caller.join(' > ')}]`;
		console[levelMethod[level]](timestamp, caller, ...args);
	}
}

export default Logger;
