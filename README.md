# StudyGraph

Personal knowledge graph learning system powered by LLM. Paste notes, upload files, or provide URLs — StudyGraph extracts knowledge points, organizes them into a navigable graph, and generates topic pages with AI-driven Q&A.

## Features

- **Multi-source ingestion** — text, PDF, DOCX, XLSX, and web URLs
- **LLM-powered extraction** — automatically identifies knowledge points, tags, and relationships
- **Knowledge graph** — visual force-directed graph of connected concepts
- **Topic pages** — AI-generated study pages with version history
- **Deep analysis** — drill down into any concept with AI-powered sub-topic expansion
- **Smart Q&A** — ask questions about your knowledge base with context-aware answers
- **Timeline & category views** — browse knowledge by time or subject
- **Export** — single-page HTML export with print-optimized CSS
- **Multi-provider LLM** — supports OpenAI-compatible APIs, Ollama, and custom endpoints

## Quick Start

```bash
npm run setup    # Install dependencies (server + portal)
npm run dev      # Start server (port 3000) + dev portal (port 3001)
```

Open `http://localhost:3000` (production build) or `http://localhost:3001` (dev mode).

## LLM Configuration

StudyGraph requires an LLM backend. Configure via the in-app Settings panel or edit `wiki/config/llm-config.json`. Supported providers:

| Provider | Config |
|----------|--------|
| OpenAI-compatible | `baseUrl`, `apiKey`, `model` |
| Ollama (local) | `baseUrl` (default `http://localhost:11434`), `model` |
| Custom endpoint | Any OpenAI-compatible API |

A template is available at `config/llm-config.template.json`.

## Project Structure

```
StudyGraph/
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
- `wiki/config/` — runtime configuration

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
