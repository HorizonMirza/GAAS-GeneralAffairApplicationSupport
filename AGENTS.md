# GAAS Repository Workflow & Agent Protocol

Repository scope:

- GitHub: `HorizonMirza/GAAS-GeneralAffairApplicationSupport`
- Local workspace: `C:\Users\purba\Downloads\GAAS`
- Default branch: `main`

## Core 5-in-1 Agent Mindset (Automated by Default)

For every interaction, the agent (`[AGY]`) must automatically operate with the combined power of these 5 core capabilities without requiring manual slash commands:

1. 🎯 **Auto `/goal` (Tenacious End-to-End Completion)**: Never abandon or half-finish a task. Execute all steps through to completion—from analysis, code editing, compilation, build verification, signed commit, pushing to GitHub, to verifying localhost services.
2. 🧠 **Auto `/boost` (Deep Multi-Perspective Reasoning)**: Exercise deep analytical thinking on every task. Evaluate architectural integrity, database consistency, CSS theme coherence, regression risks, and edge cases before and during changes.
3. 🔍 **Auto `/grill-me` (Proactive Clarification Gate)**: If any user prompt is ambiguous, underspecified, or presents multiple design directions, **STOP immediately and ask clarifying questions** before touching code. Validate user intent first to guarantee 100% satisfaction.
4. 🌐 **Auto `/browser` (Autonomous Web & Docs Research)**: Proactively retrieve official documentation, API specifications, and library references online whenever facing unfamiliar packages, APIs, or complex errors.
5. ⏱️ **Auto `/schedule` (Background Resilience & Monitoring)**: Manage asynchronous processes, background tasks, and service liveness smoothly without blocking or hanging terminal sessions.

## Standard 7-Step Operating Procedure (SOP)

For every user prompt, the agent must strictly follow this 7-step lifecycle:

1. **Receive Prompt**: Read and analyze the user's prompt, requirements, and reference files/images with `/boost` depth.
2. **Clarify Before Coding (Crucial - `/grill-me`)**: If the prompt is ambiguous, underspecified, or has multiple design options, **DO NOT assume or make code changes immediately**. Always ask the user for clarification and detail first to guarantee the result matches their exact vision.
3. **Local Revision & Verification**: Once requirements are clear, modify files directly in the local workspace (`C:\Users\purba\Downloads\GAAS`). Always verify changes (e.g. `npx tsc --noEmit`) to ensure zero compile or type errors.
4. **Signed Commit & Push to GitHub**:
   - Commit message format: ALWAYS start with `[AGY]` prefix (e.g. `[AGY] refactor: modernisasi dashboard`).
   - Stage only files related to the task.
   - Commit as `Horizon Mirza <purbandonomirza@gmail.com>`.
   - Sign every commit using the configured ED25519 SSH signing key.
   - Never add `Co-authored-by` or other AI attribution trailers.
   - Automatically push the commit to `origin main`.
5. **Verify Synchronization**: Check and confirm that local workspace and GitHub are 100% identical (`git status` clean, up to date with `origin/main`).
6. **Ensure Local Services Running**: Confirm that both services are running and listening:
   - Backend: `dotnet run` (port 8000)
   - Frontend: `npm run dev` (port 3000)
7. **Verify Localhost**: Send an HTTP request to `http://localhost:3000` to verify an HTTP 200 OK status, and report the live links and completion summary to the user (`/goal` fulfillment).

## Exceptions

- `jangan push`: leave the completed changes local and uncommitted unless the user asks for a commit.
- `review saja`: inspect and report without changing files, committing, or pushing.

After a successful push, the local checkout must remain on the pushed commit so no `git pull` is ever needed by the user.
