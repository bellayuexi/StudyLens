# StudyLens

AI-powered deep study assistant. Paste notes, upload files, or provide URLs — StudyLens extracts knowledge points, organizes them for browsing, and generates topic pages with AI-driven Q&A.

## Features

- **Multi-source ingestion** — text, PDF, DOCX, XLSX, and web URLs
- **LLM-powered extraction** — automatically identifies knowledge points, tags, and relationships
- **Knowledge graph** — visual force-directed graph of connected concepts
- **Topic pages** — AI-generated study pages with version history
- **Deep analysis** — drill down into any concept with AI-powered sub-topic expansion
- **Smart Q&A** — ask questions about your knowledge base with context-aware answers
- **Timeline & category views** — browse knowledge by time or subject
- **Export** — single-page HTML export with print-optimized CSS
- **Granularity control** — limit max knowledge points per ingestion for high-level summaries
- **Multi-provider LLM** — supports OpenAI-compatible APIs, Ollama, and custom endpoints

## Install

```bash
npm install -g studylens
studylens
```

Open `http://localhost:3000` — on first launch the Settings panel opens automatically to guide you through LLM setup.

Data is stored in `./studylens-data/` in the current directory. Set `STUDYLENS_DATA_DIR` to change the location.

## Quick Start (Development)

```bash
npm run setup    # Install dependencies (server + portal)
npm run dev      # Start server (port 3000) + dev portal (port 3001)
```

Open `http://localhost:3001` for development (hot-reload, recommended).

Port 3000 serves the production build — run `npm run build` first to generate `portal/dist/`, otherwise it will only serve the API.

## LLM Configuration

StudyLens requires an LLM backend. On first launch the Settings panel opens automatically to guide you through setup. Three options:

### Option A: Agent Maestro (recommended for GitHub Copilot users)

Zero API key needed — uses your existing Copilot subscription via VS Code.

1. Install the [Agent Maestro](https://marketplace.visualstudio.com/items?itemName=Joouis.agent-maestro) VS Code extension
2. It starts a local proxy at `http://localhost:23333`
3. In StudyLens settings, enable `agent-maestro` and test the connection

### Option B: OpenAI-compatible API

Works with OpenAI, Azure OpenAI, DeepSeek, or any compatible endpoint.

1. In StudyLens settings, enable `openai-compatible`
2. Set `baseUrl` (default: `https://api.openai.com/v1`), `apiKey`, and `model`

### Option C: Ollama (fully local, free)

Run models locally with no API key or internet required.

1. Install [Ollama](https://ollama.com) and pull a model: `ollama pull llama3.2`
2. In StudyLens settings, enable `ollama` (default URL: `http://localhost:11434`)

Configuration is stored in `config/llm-config.json` (gitignored — holds your API keys). A template is at `config/llm-config.template.json`.

## Project Structure

```
StudyLens/
├── server/           # Express API server
│   └── index.js
├── core/             # Business logic
│   ├── extractor.js       # Knowledge extraction prompts
│   ├── llm-provider.js    # Multi-provider LLM client
│   └── wiki-storage.js    # Markdown-based file storage
├── portal/           # React frontend (Vite)
│   └── src/
│       ├── components/    # UI components
│       └── lib/           # Shared utilities
├── config/           # Configuration templates
├── e2e/              # Playwright E2E tests
├── tests/            # API integration tests
├── scripts/          # Utility scripts
└── docs/             # User & developer guides
```

## Data Storage

All data is stored as Markdown files in the `wiki/` directory (gitignored by default):

- `wiki/entries/` — knowledge point Markdown files with YAML frontmatter
- `wiki/topic-pages/` — generated topic page HTML
- `wiki/index/` — JSON indexes for fast lookup

## Testing

```bash
npm test              # Unit tests (API + portal)
npm run test:e2e      # Playwright E2E tests
npm run test:api      # API tests only
npm run test:portal   # Portal component tests only
```

## Scripts

```bash
npm run server        # Start API server only (port 3000)
npm run portal        # Start Vite dev server only (port 3001)
npm run dev           # Start both concurrently
npm run setup         # Install all dependencies
```

## License

MIT
