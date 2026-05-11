# SHL Assessment Recommender API

A production-ready conversational API that helps hiring managers find the right SHL Individual Test Solutions through dialogue. The system classifies intent, retrieves catalog-grounded assessments, and uses an LLM to generate concise, professional responses.

---

## Local Setup

### Prerequisites

- Node.js 24+
- pnpm
- A Replit project (for AI Integrations) **or** your own OpenAI API key

### Install

```bash
pnpm install
```

### Environment Variables

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | OpenAI-compatible base URL (auto-set by Replit AI Integrations, or use `https://api.openai.com/v1`) |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | API key (auto-set by Replit AI Integrations, or your own OpenAI key) |
| `DATABASE_URL` | PostgreSQL connection string (optional for chat functionality) |
| `PORT` | Port to listen on (default: `5000`) |

### Run Locally

```bash
pnpm --filter @workspace/api-server run dev
```

The server starts at `http://localhost:5000`. All routes are prefixed with `/api`.

### Production Start

```bash
# Build
pnpm --filter @workspace/api-server run build

# Start
pnpm --filter @workspace/api-server run start
```

Or with uvicorn-style one-liner for deployment platforms:

```bash
NODE_ENV=production node --enable-source-maps ./artifacts/api-server/dist/index.mjs
```

---

## API Reference

### GET /api/health

Returns server health status.

**Response:**
```json
{ "status": "ok" }
```

### POST /api/chat

Stateless conversational endpoint. Pass the full conversation history on every request.

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "I need to hire a Java developer" },
    { "role": "assistant", "content": "..." },
    { "role": "user", "content": "They also need good communication skills" }
  ]
}
```

**Response:**
```json
{
  "reply": "Based on your requirements...",
  "recommendations": [
    {
      "name": "Verify Numerical Reasoning",
      "url": "https://www.shl.com/products/product-catalog/view/verify-numerical-reasoning-test/",
      "test_type": "Cognitive"
    }
  ],
  "end_of_conversation": false
}
```

**Behavior:**
- `recommendations` is `[]` when clarifying, refusing, or handling comparisons without an explicit shortlist request
- `recommendations` contains 1–10 items when enough context exists
- `end_of_conversation` is `true` only when the task is fully resolved
- Every recommendation includes a real catalog URL — no hallucinated entries

---

## Architecture

```
artifacts/api-server/src/
├── app.ts                    # Express app setup (CORS, pino logging, routes)
├── index.ts                  # Server entry point
├── routes/
│   ├── index.ts              # Route barrel
│   ├── health.ts             # GET /healthz
│   └── chat.ts               # GET /health + POST /chat
└── lib/
    └── shl/
        ├── catalog.ts        # Catalog loader (reads catalog.json)
        ├── retriever.ts      # TF-IDF + keyword retrieval
        ├── conversation.ts   # Intent classification from message history
        ├── prompts.ts        # System prompt builder (grounded, intent-aware)
        └── llm.ts            # OpenAI wrapper with schema validation

artifacts/api-server/src/data/
└── catalog.json              # SHL Individual Test Solutions dataset
```

**Key design decisions:**

- **Stateless by design** — every `/chat` call receives full message history; no server-side memory
- **Retrieval before generation** — relevant catalog items are selected before calling the LLM, preventing hallucination
- **Output validation** — LLM recommendations are cross-checked against the catalog; invalid items are removed
- **Intent classification** — rule-based regex patterns classify vague/compare/refine/off-topic/injection before the LLM is involved
- **TF-IDF retrieval** — no embeddings API required; deterministic, fast, and explainable

---

## Supported Test Cases

| Scenario | Behavior |
|---|---|
| "I need an assessment" | Asks one clarification question |
| "Hiring a Java developer" | Returns relevant coding/cognitive assessments |
| "Hiring a Java developer who works with stakeholders" | Adds personality/behavioral assessments |
| "Actually, add personality tests" | Refines the shortlist |
| "What is the difference between OPQ and Verify G+?" | Compares using catalog data only |
| "Give me general hiring advice" | Politely refuses |
| Prompt injection attempt | Refuses and redirects |
| Job description pasted | Extracts role/skills and recommends |
| Seniority change mid-conversation | Recomputes from full history |

---

## Deployment

### Render / Railway / Fly.io

Set these environment variables in your deployment dashboard:

- `AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1`
- `AI_INTEGRATIONS_OPENAI_API_KEY=<your-openai-key>`
- `PORT=<assigned-by-platform>`

Build command:
```bash
pnpm install && pnpm --filter @workspace/api-server run build
```

Start command:
```bash
node --enable-source-maps ./artifacts/api-server/dist/index.mjs
```

### Secrets Required

| Secret | Where to get it |
|---|---|
| `AI_INTEGRATIONS_OPENAI_API_KEY` | [OpenAI Platform](https://platform.openai.com/api-keys) |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Use `https://api.openai.com/v1` for production |

---

## Evaluation Notes

- Schema is always valid — every response has `reply` (string), `recommendations` (array), `end_of_conversation` (boolean)
- Zero hallucinations — all recommendations are validated against the catalog before returning
- Concise responses — designed to complete within a 30-second timeout
- 8-turn limit friendly — intent classification uses full history to avoid repetitive clarifications
