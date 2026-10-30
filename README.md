# BrandGuard AI

> **Built together, in parallel.** Our team worked on two BrandGuard models simultaneously and brought both to a working state. Explore the two live versions:
>
> - **BrandGuard model 1:** [Open the Vercel version](https://brandguard-ai-seven.vercel.app/)
> - **BrandGuard model 2:** [Open the Render version](https://brandguard-ai-nvfs.onrender.com/)

BrandGuard AI is a content-review workspace for checking marketing copy for potential brand and compliance risks. It combines automated analysis with a review workflow so a team can inspect findings, consider suggested rewrites, and track approval status.

**Live app:** https://brandguard-ai-seven.vercel.app

## What you can do

- Paste marketing copy or load an example to start a review.
- Run an analysis and inspect findings by severity.
- Review the evidence and explanation behind each finding.
- Accept or reject rewrite suggestions, then apply accepted changes to the draft.
- Save drafts and submit them for approval.
- Browse reviews by status, search them, and open saved review details.
- Use templates and sample review data to explore the interface.

> Analysis is an aid to review, not legal advice or a guarantee of regulatory compliance. Check factual claims and supporting evidence before publishing. When the AI service is unavailable, the API can return deterministic rule-based findings instead; these fallback checks are narrower and do not generate context-aware rewrites.

## Project structure

```text
.
├── frontend/   # React + TypeScript + Vite application
└── worker/     # Cloudflare Worker API and analysis service
```

## Requirements

- Node.js with npm
- A Groq API key for live AI analysis
- Cloudflare account and Wrangler CLI access if you intend to run/deploy the Worker

## Run the frontend locally

1. Open a terminal in the repository.
2. Install frontend dependencies:

   ```bash
   cd frontend
   npm install
   ```

3. Create your local environment file by copying the example:

   **Windows PowerShell**
   ```powershell
   Copy-Item .env.example .env
   ```

   **macOS / Linux**
   ```bash
   cp .env.example .env
   ```

4. If you are using the deployed API, you can leave `VITE_API_URL` empty; the frontend has a default Worker URL. To use a different Worker, set `VITE_API_URL` to its base URL.
5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open the local URL printed by Vite (usually http://localhost:5173).

## Run the API locally

The API lives in `worker/`.

1. Open a second terminal and install dependencies:

   ```bash
   cd worker
   npm install
   ```

2. Create `.dev.vars` in the `worker/` directory and add your Groq key:

   ```dotenv
   GROQ_API_KEY=your_groq_api_key
   ```

   Keep `.dev.vars` private. Do not commit API keys.

3. Start the Worker:

   ```bash
   npm run dev
   ```

4. Set `VITE_API_URL` in `frontend/.env` to the local Worker URL shown by Wrangler (commonly http://localhost:8787), then restart the Vite server.

The Worker accepts `GROQ_API_KEY` and optional `ALLOWED_ORIGINS` environment values. `ALLOWED_ORIGINS` is a comma-separated list of browser origins allowed by the CORS configuration.

### Review storage

The Worker supports an optional Cloudflare KV binding named `REVIEWS_KV`. If it is not configured, review data uses an in-memory fallback and should not be treated as durable storage across Worker restarts or instances. Configure the KV namespace binding in the Wrangler configuration before relying on persistent review records in a deployed environment.

## How to use the website

1. Open the app and choose **New Review** from the dashboard.
2. Paste your marketing content into the editor, or choose **Load Sample** to try an example.
3. Select **Analyze Content**. Wait for the findings to appear.
4. Review each finding's severity, highlighted evidence, and explanation. Read suggested replacement text carefully; automated suggestions can require human verification.
5. Choose **Accept** for suggestions you want to keep or **Reject** to dismiss them.
6. Select **Apply accepted suggestions** when you are ready to update the text in the editor.
7. Save the review as a draft, or submit it for approval.
8. Open **My Reviews** to search, filter, and revisit saved reviews. Use the status sections to find pending, approved, or changes-requested items.
9. In **Settings**, you can switch between live API mode and local demo mode, enable the approver controls, test the backend connection, or manage local demo data.

### Demo mode vs. live mode

- **Live API mode:** Sends content to the configured Cloudflare Worker for analysis and stores reviews through the Worker. The AI analysis requires a configured Groq API key.
- **Demo mode:** Uses browser local storage and seeded sample reviews. It is useful for exploring the review interface without the live API. AI analysis is disabled in demo mode.

The demo-mode setting is available in **Settings**. The `VITE_USE_FAKE` environment variable can set its initial value; a browser-saved setting takes precedence.

## Available commands

| Directory | Command | Purpose |
| --- | --- | --- |
| `frontend/` | `npm run dev` | Start Vite development server |
| `frontend/` | `npm run build` | Type-check and build the frontend |
| `frontend/` | `npm run test` | Run frontend tests |
| `frontend/` | `npm run lint` | Run Oxlint |
| `frontend/` | `npm run preview` | Preview the production build |
| `worker/` | `npm run dev` | Run the Worker locally with Wrangler |
| `worker/` | `npm run typecheck` | Type-check the Worker |
| `worker/` | `npm run deploy` | Deploy the Worker using Wrangler |

## Deployment notes

- **Frontend:** Deploy the `frontend/` directory as the Vercel project root. Set `VITE_API_URL` to the deployed Worker base URL when it differs from the default configured in `frontend/src/api.ts`.
- **Worker:** Deploy from the `worker/` directory with `npm run deploy`. Configure `GROQ_API_KEY` as a Worker secret in Cloudflare; do not put it in frontend environment variables.
- Configure the `REVIEWS_KV` binding before using the Worker for durable review storage.
- Configure the Worker CORS origin list for the frontend's production domain and any required preview/local origins.

## Notes and limitations

- The frontend limits editor input to 5,000 characters; the Worker currently accepts up to 10,000 characters per analysis request.
- The Worker enforces a 50 KB request payload limit.
- Rule-based fallback results are not equivalent to AI analysis.
- Treat all findings and rewrites as review suggestions. Verify claims, evidence, and applicable requirements independently.
