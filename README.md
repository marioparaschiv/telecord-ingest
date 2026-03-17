# telecord-ingest-discord

Discord bot that forwards messages, reactions, and events to the [Telecord](https://beta.telecord.app) ingest API.

## Setup

1. Install dependencies:

```bash
bun install
```

2. Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `DISCORD_TOKEN` | Yes | Discord bot token |
| `API_KEY` | Yes | Telecord API key |
| `BASE_URL` | No | API base URL (defaults to `https://beta.telecord.app/api`) |

3. Run:

```bash
bun start
# or with hot reload:
bun dev
```

## API Documentation

See [beta.telecord.app/api/docs](https://beta.telecord.app/api/docs) for the full ingest API specification.
