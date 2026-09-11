# Top Hills Laundry Journal — contributor workflow

## Project and source

- GitHub repository: `https://github.com/Oksana3301/TOPHILLSLAUNDRYJOURNAL.git`.
- Integration branch: `main`.
- Atika requested on 11 September 2026 that updates made while working on this project in ChatGPT include fetching/pulling the latest source, committing the requested changes, and pushing them to this repository. Follow her current instructions and applicable tool approvals; this workflow does not authorize unrelated changes, account changes, or deployment.
- Read `README.md` and the relevant module documentation before editing. The initial import is `TOPHILLSLAUNDRYJOURNAL-GitHub-Ready.zip`, SHA-256 `4ce9e3751a66e6129b22d0791e7a5566c18c549b5a7c3044c6d0b02bf9bafc1f`.

## Every requested update

1. Confirm this checkout's repository, current branch, and `git status`. Preserve existing user changes. Use an isolated branch/worktree when needed.
2. Fetch `origin` and inspect upstream commits. On a clean `main`, run `git pull --ff-only origin main` before editing. If histories have diverged, inspect and reconcile the actual changes without discarding work or force-pushing.
3. Make the requested changes and run the relevant existing checks. Review `git diff` and stage only files belonging to the task. Never stage credentials, customer exports, database files, or local build caches.
4. Commit with a concise explanation of the change. Fetch again before pushing; reconcile any new remote commits, then push to the intended branch. Use an ordinary fast-forward push. If branch protection requires a pull request, use that supported workflow instead.
5. Verify the remote commit and changed files. Report the branch, commit link, checks performed, and any material limitation. A local commit or a created Git blob is not a successful push until the remote branch points to the completed commit.

## Connection options

- Prefer the connected GitHub plugin for repository access and verification. Use native Git for checkout and bulk transfers when authenticated Git transport is available.
- If native Git cannot authenticate but the connector has write access, use GitHub blobs, a tree based on the current remote tree, a commit with the current remote parent, and a non-forced branch update. Preserve existing paths outside the requested change. Verify the branch after updating it, then fetch/pull the published commit into the local checkout.
- Never request a token or password in chat, embed credentials in remote URLs, or print credentials. Report a genuine connection/approval block when it prevents completion.

## Project constraints

- `dist/` contains authored frontend source and must remain tracked. Only generated `dist/server/`, `dist/.openai/`, and `.sites-runtime/` are ignored.
- Keep source assets, vendor licenses, SOP originals, requirements, and design references in the repository.
- Preserve `.openai/hosting.json` and the existing Site identity. Pushing to GitHub does not deploy the Site or change its audience.
- The Site selects one data backend through runtime DATA_BACKEND. The Supabase Edge backend supports PostgreSQL, private Storage and Auth; D1/R2 is retained for the controlled migration and rollback. Check `docs/supabase/MIGRATION-HANDOFF.md` for the recorded cutover status. Never silently fall back after Supabase activation.
- Do not reset production data, run business-data migrations, activate payments, or deploy unless included in the user's request.
- Use Node.js 24 (the tests use `node:sqlite`). Existing checks are documented in `README.md`.

## Session scope

This file guides work whenever an assistant opens this repository. It is not a background service: ChatGPT edits, local computer edits, the deployed Site, and the database are not automatically synchronized outside an active project task. Start a new session by opening this repository and reading this file.
