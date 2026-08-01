# Deepening Modules

## Dependency Categories

1. **In-process**: pure computation or in-memory state. Merge and test through the new interface.
2. **Local-substitutable**: local test stand-ins such as an in-memory filesystem or embedded database.
   Keep the dependency behind an internal seam and run the stand-in in tests.
3. **Remote but owned**: an internal service. Define a port at the seam, inject the transport adapter,
   and test with an in-memory adapter.
4. **True external**: a third-party service. Inject a narrow port and use a controlled fake or mock
   adapter at the same seam.

## Seam Discipline

- Do not expose an internal seam merely because a test uses it.
- One adapter is hypothetical; production plus test adapters make a real seam.
- Prefer one deep external interface over a chain of public pass-through modules.
- New tests observe behavior through the deepened interface.
- Delete superseded shallow tests once equivalent behavior is covered at the new seam.

## Safe Migration

1. Record the old public behavior and compatibility constraints.
2. Add the new interface beside the old when an atomic change cannot remain green.
3. Move callers in reversible batches.
4. Run tests at the new interface and existing public boundaries.
5. Remove the old interface only when no callers remain and rollback evidence exists.
