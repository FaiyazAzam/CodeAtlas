# CodeAtlas

CodeAtlas is a polished MVP developer tool for understanding unfamiliar GitHub repositories quickly. Paste a public repo URL and get a visual architecture map, repo explorer, module summaries, inferred entry points, likely data flow, dependencies, and a newcomer reading guide.

## Features

- Public GitHub repo ingestion through the GitHub REST API.
- Noise filtering for build output, dependency folders, lockfiles, binaries, and oversized files.
- Heuristic architecture analysis based on file tree, naming conventions, framework files, and common folder patterns.
- Optional LLM enhancement for better file, folder, and architecture summaries.
- Commit-aware Redis caching to avoid repeated LLM work for the same repo commit.
- API rate limiting and request timeouts for deployment safety.
- Interactive architecture map with subsystem details and confidence labels.
- File explorer with purpose summaries and start-here highlights.
- Onboarding guide with structure summary, top files, probable flow, and open questions.
- Mock fallback data for reliable demos when GitHub fetching fails.
- Markdown export for sharing an architecture summary.
- Toggle between New Developer View and System Design View.

## Tech Stack

- Next.js
- TypeScript
- Tailwind CSS
- GitHub REST API
- OpenAI API
- Upstash Redis for Vercel-compatible app-level caching
- Custom lightweight SVG graph for the MVP

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

Build for production:

```bash
npm run build
```

Run tests:

```bash
npm test
```

Lint:

```bash
npm run lint
```

## Optional GitHub Token

Unauthenticated GitHub API requests are rate limited. For smoother local demos, set a token:

```bash
GITHUB_TOKEN=your_token_here
```

Use a low-scope fine-grained GitHub token with public repository read access only.

## Optional LLM Enhancement

CodeAtlas works without an LLM. If `OPENAI_API_KEY` is present, the server adds an LLM-enhanced analysis pass:

1. The app sends the filtered repo tree to the model.
2. The model identifies important files that heuristics might miss.
3. CodeAtlas combines model picks, filename signals, framework rules, and repo structure into a hybrid score.
4. The server fetches selected file contents.
5. The model returns structured summaries, architecture notes, onboarding guidance, and ambiguities.

Create `.env.local`:

```bash
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL_FAST=gpt-4.1-mini
OPENAI_MODEL_REASONING=gpt-4.1-mini
LLM_MAX_FILES=24
LLM_MAX_FILE_CHARS=8000
LLM_MAX_TOTAL_CHARS=90000
```

Use a smaller model for fast tree/file triage and a stronger model for the final synthesis if you want better quality.

## Optional Redis Cache

Vercel KV has been sunset for new projects. Use a Redis integration from the Vercel Marketplace, such as Upstash Redis. The app uses `@upstash/redis` and supports both env naming styles:

```bash
UPSTASH_REDIS_REST_URL=your_redis_rest_url
UPSTASH_REDIS_REST_TOKEN=your_redis_rest_token
```

or:

```bash
KV_REST_API_URL=your_redis_rest_url
KV_REST_API_TOKEN=your_redis_rest_token
```

Cache behavior:

- Cache keys include repo owner, repo name, default branch, latest commit SHA, model names, LLM limits, and analysis cache version.
- If the repo updates, the commit SHA changes and CodeAtlas runs a fresh analysis.
- `Refresh Analysis` bypasses the cache manually.
- `CACHE_TTL_SECONDS` defaults to 30 days.

## Rate Limiting

The analyze API is rate limited before GitHub or OpenAI work starts. Redis is used when configured; local development falls back to an in-memory limiter.

```bash
RATE_LIMIT_MAX_REQUESTS=15
RATE_LIMIT_WINDOW_SECONDS=3600
LLM_RATE_LIMIT_MAX_REQUESTS=5
LLM_RATE_LIMIT_WINDOW_SECONDS=86400
```

Responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After` on `429` responses.

Fresh LLM summaries use their own daily IP limit. Cached analyses do not consume the LLM limit. If the LLM limit is reached, CodeAtlas still returns the heuristic analysis.

## Request Timeouts

Large repos and slow upstream APIs are bounded with server-side timeouts:

```bash
GITHUB_FETCH_TIMEOUT_MS=15000
FILE_FETCH_TIMEOUT_MS=8000
LLM_TIMEOUT_MS=60000
ANALYZE_TOTAL_TIMEOUT_MS=120000
```

If a timeout fires, CodeAtlas returns the existing graceful fallback path instead of leaving the request hanging.

## Production Environment Checklist

Required for LLM-backed deployment:

```bash
HEALTHCHECK_TOKEN=
OPENAI_API_KEY=
OPENAI_MODEL_FAST=gpt-4.1-mini
OPENAI_MODEL_REASONING=gpt-4.1-mini
```

Recommended for production reliability:

```bash
GITHUB_TOKEN=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
CACHE_TTL_SECONDS=2592000
RATE_LIMIT_MAX_REQUESTS=15
RATE_LIMIT_WINDOW_SECONDS=3600
LLM_RATE_LIMIT_MAX_REQUESTS=5
LLM_RATE_LIMIT_WINDOW_SECONDS=86400
GITHUB_FETCH_TIMEOUT_MS=15000
FILE_FETCH_TIMEOUT_MS=8000
LLM_TIMEOUT_MS=60000
ANALYZE_TOTAL_TIMEOUT_MS=120000
LLM_MAX_FILES=24
LLM_MAX_FILE_CHARS=8000
LLM_MAX_TOTAL_CHARS=90000
```

Before public launch:

- Confirm the GitHub repo does not include `.env.local`, `.vercel`, `.next`, `node_modules`, or dev logs.
- Confirm `OPENAI_API_KEY` works in the deployed environment.
- Confirm Redis cache returns a miss then a hit for the same repo commit.
- Confirm GitHub requests do not rate-limit during smoke tests.
- Confirm `Refresh Analysis` bypasses cache and writes a new cached result.
- Confirm `429` responses appear after the configured rate-limit threshold.
- Keep `.env.local` local only. Never commit secrets.

## Vercel Smoke Test Checklist

After deploying to Vercel, set `APP_URL` and `HEALTHCHECK_TOKEN` locally:

```bash
APP_URL=https://your-codeatlas-app.vercel.app
HEALTHCHECK_TOKEN=your_healthcheck_token
```

On Windows PowerShell:

```powershell
$env:APP_URL="https://your-codeatlas-app.vercel.app"
$env:HEALTHCHECK_TOKEN="your_healthcheck_token"
```

1. Verify the app responds:

```bash
curl -I "$APP_URL"
```

PowerShell:

```powershell
Invoke-WebRequest -Uri $env:APP_URL -Method Head
```

2. Verify production env vars and live service connectivity:

```bash
curl "$APP_URL/api/health?deep=1" -H "x-codeatlas-health-token: $HEALTHCHECK_TOKEN"
```

PowerShell:

```powershell
Invoke-RestMethod -Uri "$env:APP_URL/api/health?deep=1" -Headers @{ "x-codeatlas-health-token" = $env:HEALTHCHECK_TOKEN }
```

Expected result:

```text
status: ok
checks.github.status: pass
checks.openai.status: pass
checks.redis.status: pass
```

3. Verify Redis cache miss then hit:

```bash
curl "$APP_URL/api/analyze" \
  -H "content-type: application/json" \
  -d '{"repoUrl":"https://github.com/octocat/Spoon-Knife"}'

curl "$APP_URL/api/analyze" \
  -H "content-type: application/json" \
  -d '{"repoUrl":"https://github.com/octocat/Spoon-Knife"}'
```

PowerShell:

```powershell
$body = @{ repoUrl = "https://github.com/octocat/Spoon-Knife" } | ConvertTo-Json
Invoke-RestMethod -Uri "$env:APP_URL/api/analyze" -Method Post -ContentType "application/json" -Body $body
Invoke-RestMethod -Uri "$env:APP_URL/api/analyze" -Method Post -ContentType "application/json" -Body $body
```

Expected result:

```text
first uncached request: analysis.cache.status = miss
second same request: analysis.cache.status = hit
```

If you previously tested the same repo, the first request may already be `hit`. Use **Refresh Analysis** in the UI or send `x-codeatlas-refresh: true` to force a fresh run.

4. Verify OpenAI and GitHub are working through the real product path:

```text
analysis.source should be llm
analysis.repo.latestCommitSha should be present
analysis.cache.commitSha should match the repo commit
```

5. Verify rate-limit headers:

```bash
curl -i "$APP_URL/api/analyze" \
  -H "content-type: application/json" \
  -d '{"repoUrl":"https://github.com/vercel/commerce"}'
```

Expected headers:

```text
X-RateLimit-Limit
X-RateLimit-Remaining
X-RateLimit-Reset
```

## Project Structure

```text
app/
  api/analyze/route.ts      API route for repo ingestion and analysis
  api/health/route.ts       Protected production healthcheck
  icon.svg                  Favicon
  layout.tsx                App metadata and fonts
  page.tsx                  Main product experience
components/
  ArchitectureGraph.tsx     Interactive architecture map
  FileExplorer.tsx          Repo tree and file detail panel
  OnboardingGuidePanel.tsx  New developer guide
  OverviewPanel.tsx         Stack, insight, and important file overview
  RepoInput.tsx             Repo URL input and sample repos
data/
  mockAnalysis.ts           Demo-ready fallback analysis data
lib/
  analyzer.ts               Heuristic architecture analysis pipeline
  cache.ts                  Redis-backed commit-aware analysis cache
  github.ts                 GitHub URL parsing and tree fetching
  llmAnalysis.ts            Optional OpenAI analysis enhancement
  rateLimit.ts              Redis-backed or memory-backed API rate limiting
  timeouts.ts               GitHub, file, LLM, and total request timeouts
  exportMarkdown.ts         Markdown export helper
types/
  analysis.ts               Shared app contracts
```

## Analysis Pipeline

The MVP pipeline is intentionally fast and explainable:

1. Parse and validate the GitHub repository URL.
2. Fetch repository metadata and recursive file tree.
3. Remove noisy files and folders.
4. Detect languages, frameworks, test tools, and database signals.
5. Infer major modules from framework and folder conventions.
6. Generate folder/file summaries and confidence labels.
7. Build a readable graph and onboarding guide.
8. If Redis is configured, cache the result by latest commit SHA.

TODO: add deeper import parsing, package manifest dependency extraction, code content summarization, embeddings, and optional LLM enrichment.

## GitHub Push Checklist

Before pushing:

```bash
npm run lint
npm test
npm run build
git status --short
```

Confirm ignored local-only files are not staged:

```text
.env.local
.vercel/
.next/
node_modules/
.next-dev.*.log
```

Recommended first commit:

```bash
git add .
git commit -m "Build CodeAtlas MVP"
git branch -M main
git remote add origin <github-repo-url>
git push -u origin main
```

## Demo Repos

The app includes sample entries for:

- `https://github.com/vercel/commerce`
- `https://github.com/supabase/supabase`
- `https://github.com/calcom/cal.com`

If GitHub analysis fails, CodeAtlas returns realistic fallback data so the product remains demoable.

## Roadmap

- Parse import graphs for TypeScript, JavaScript, Python, and Go.
- Read selected source files for better summaries.
- Add dependency graph extraction from manifests.
- Add repo size-aware background analysis jobs.
- Persist previous analyses locally or with a lightweight database.
- Add shareable report URLs.
- Add richer graph layouts with collapse and clustering.
- Add tests for URL parsing, filtering, stack detection, and onboarding generation.
