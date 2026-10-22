# BrandGuard AI

BrandGuard AI is a brand-safety review application with a React frontend and a
Node.js/TypeScript backend.

## Backend setup

The backend is in `backend/` and requires Node.js 18 or later.

1. Open a terminal in `backend/`.
2. Install the packages:

   ```sh
   npm install
   ```

3. Copy `.env.example` to `.env` and set the values for your environment.
4. Start the development server:

   ```sh
   npm run dev
   ```

The API listens on port `3001` by default. Set `PORT` when your environment
requires another port. The health endpoint is `GET /api/health`.

### Backend environment variables

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port; defaults to `3001` locally. Hosted platforms may provide this automatically. |
| `FRONTEND_ORIGIN` | Exact frontend origin allowed by CORS, for example `https://brandguard.example.com`. Defaults to `http://localhost:5173`. |
| `SUPABASE_URL` | Supabase project URL used for review storage. |
| `SUPABASE_SERVICE_KEY` | Private Supabase service-role key used only by the backend. Never put it in frontend settings or commit it. |
| `LLM_PROVIDER` | Provider selection: `ollama`, `gemini`, `groq`, or `openrouter`. Defaults to `ollama`. |
| `LLM_TIMEOUT_MS` | Positive request timeout in milliseconds; defaults to `30000`. |
| `OLLAMA_URL` | Reachable Ollama server URL; defaults to `http://localhost:11434`. |
| `OLLAMA_MODEL` | Model name used by Ollama. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Gemini API key and model name. |
| `GROQ_API_KEY`, `GROQ_MODEL` | Groq API key and model name. |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | OpenRouter API key and model name. |

Only set the model and credential variables for the selected provider. Keep
credentials in the hosting platform's secret/environment-variable settings.
Never commit `.env` or include real keys in documentation.

To create the review table, open the Supabase project's **SQL Editor**, run the
contents of `backend/supabase.sql`, and set `SUPABASE_URL` and
`SUPABASE_SERVICE_KEY` in the backend environment.

## Deploying the backend

Deploy `backend/` as the service root on a Node.js/TypeScript hosting service:

1. Select Node.js 18 or later and configure the service root as `backend/`.
2. Set the build command to:

   ```sh
   npm install && npm run build
   ```

3. Set the start command to:

   ```sh
   npm start
   ```

4. Configure the environment variables listed above. Set `FRONTEND_ORIGIN` to
   the deployed frontend's exact origin (scheme and host, without an API path).
   Configure the frontend's `VITE_API_URL` to the deployed backend URL.
5. Ensure the selected LLM provider is reachable from the hosted backend.
   Local Ollama works only when the deployment can reach its Ollama server;
   `localhost` on a hosting service refers to the service container, not your
   development computer. Use a reachable hosted provider or a deliberately
   network-accessible Ollama instance.
6. Apply `backend/supabase.sql` to the Supabase project and configure the
   backend's Supabase environment variables before using review endpoints.
7. After deployment, verify `GET /api/health` on the backend URL and check the
   hosting service logs for startup errors. Do not log API keys, prompts, or
   submitted content.

The frontend and backend are separate services; deploying the backend does not
change the frontend's existing API contract.
