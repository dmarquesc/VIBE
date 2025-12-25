
# VIBE Backend (Express, ESM)

## Quick start
1) Copy `.env.example` to `.env` and adjust (at least `ALLOWED_ORIGINS`).
2) `npm install`
3) `npm run dev`  (or `npm start`)

Check: `GET http://localhost:3000/api/health` → `{ "ok": true }`

## Chat endpoint
`POST /api/chat`

Body:
```json
{ "history": [ { "role": "user", "content": "Say hello" } ] }
```

Headers (optional):
```
x-vibe-client: phase1-ui
```

Response:
```json
{ "reply": "Hello..." }
```

### Models
- With `OPENAI_API_KEY` set → routes to OpenAI.
- Else tries local **Ollama** (`OLLAMA_URL`) → e.g., `ollama run llama3`.
- If neither is available → returns a helpful echo string.

## CORS
`ALLOWED_ORIGINS` is a comma-separated list, e.g.
```
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com
```

