# GAAS Repository Workflow

Repository scope:

- GitHub: `HorizonMirza/GAAS-GeneralAffairApplicationSupport`
- Local workspace: `C:\Users\purba\Downloads\GAAS`
- Default branch: `main`

For prompts that request code or documentation changes:

1. Work in the local workspace first.
2. Preserve unrelated local changes and stage only files that belong to the task.
3. Commit as `Horizon Mirza <purbandonomirza@gmail.com>`.
4. Sign every commit using the configured SSH signing key.
5. Do not add `Co-authored-by` or other AI attribution trailers.
6. Push the completed commit to the matching branch on `origin` automatically.
7. Never force-push or rewrite published history unless the user explicitly requests it.

Exceptions:

- `jangan push`: leave the completed changes local and uncommitted unless the user asks for a commit.
- `review saja`: inspect and report without changing files, committing, or pushing.

After a successful push, the local checkout must remain on the pushed commit so no pull is needed before running the application.
