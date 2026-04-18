# AGENTS.md

## Project Overview
- **Project:** CodeAtlas - a developer tool that ingests public GitHub repositories and explains their architecture visually.
- **Target user:** developers learning unfamiliar repositories.
- **Access model:** anonymous public access with IP-based rate limiting.
- **Stack:** Next.js, TypeScript, Tailwind CSS, GitHub REST API, OpenAI API, Upstash Redis, Vitest.

## Commands
- **Install:** `npm install`
- **Dev:** `npm run dev`
- **Build:** `npm run build`
- **Test:** `npm test`
- **Lint:** `npm run lint`

## Do
- Read existing code before modifying anything
- Match existing patterns, naming, and style
- Handle errors gracefully  no silent failures
- Keep changes small and scoped to what was asked
- Run dev/build after changes to verify nothing broke
- Ask clarifying questions before guessing

## Don't
- Install new dependencies without asking
- Delete or overwrite files without confirming
- Hardcode secrets, API keys, or credentials
- Rewrite working code unless explicitly asked
- Push, deploy, or force-push without permission
- Make changes outside the scope of the request

## When Stuck
- If a task is large, break it into steps and confirm the plan first
- If you can't fix an error in 2 attempts, stop and explain the issue

## Testing
- Run existing tests after any change
- Add at least one test for new features
- Never skip or delete tests to make things pass
- Current tests live in `tests/`

## Git
- Small, focused commits with descriptive messages
- Never force push
- Never commit `.env.local`, `.vercel`, `.next`, `node_modules`, or dev logs

## Project Notes
- The main app UI is in `app/page.tsx`
- The repo analysis API route is `app/api/analyze/route.ts`
- GitHub ingestion logic is in `lib/github.ts`
- Heuristic architecture analysis is in `lib/analyzer.ts`
- Mock fallback data is in `data/mockAnalysis.ts`
- Shared analysis types are in `types/analysis.ts`
- LLM enhancement should stay server-side only and must gracefully fall back to heuristics
- Redis caching is in `lib/cache.ts`; cache keys must include latest commit SHA to avoid stale repo results
- API rate limiting is in `lib/rateLimit.ts`; keep it before GitHub/OpenAI work in the analyze route
- Network and LLM timeout helpers are in `lib/timeouts.ts`; keep large repo work bounded
- Production health checks are in `app/api/health/route.ts`; protect them with `HEALTHCHECK_TOKEN`
- `app/icon.svg` is the favicon
- Keep the MVP simple and demo-friendly before adding deeper analysis
- Add deeper repo intelligence later through import parsing, source file summaries, dependency extraction, embeddings, or LLM enrichment

## Response Style
- always respond with clear & concise messages
- use plain English when explaining to the User
- avoid long sentences, complex words, or long paragraphs
