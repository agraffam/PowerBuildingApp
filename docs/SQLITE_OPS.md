# SQLite operations and scaling expectations

This app uses **SQLite** via Prisma (`DATABASE_URL=file:...`). It fits a **single Node writer** and modest concurrency.

## Backups

- Stop the app (or rely on SQLite WAL + file copy) and copy the database file regularly.
- Test a restore on a staging copy before you depend on a backup.

## Permissions

- Keep the DB file readable/writable only by the app user; avoid world-readable paths.

## When writes contend

- Under load you may see `SQLITE_BUSY` or slow writes. That is a signal to reduce concurrent writers or eventually move to a server database—not an emergency for small deployments.

## Horizontal scale

- **Multiple app instances** writing the same SQLite file over a network filesystem is not supported.
- In-memory **rate limits** (login/register) do not sync across instances; use a shared store or edge limits if you add replicas.

See also [DEPLOY.md](./DEPLOY.md) for container volume layout.
