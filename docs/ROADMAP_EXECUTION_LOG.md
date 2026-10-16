
## 2026-10-14 — Phase 5 Redis/BullMQ export workers and notifications

Migrated tenant export processing from the API process trigger to a shared BullMQ queue named `tenant-exports`, backed by Redis. Export jobs remain durable in PostgreSQL while BullMQ provides queue persistence, retry/backoff, stalled-job recovery, and competing workers for horizontal API/worker scaling. Workers process up to two exports concurrently per instance and retry transient failures up to three times with exponential backoff.

Added Redis to local Docker Compose with append-only persistence and health checks, and documented `REDIS_URL`. Export completion and final failure now emit signed organization-scoped webhook notifications using the existing webhook configuration model. Supported events are `tenant_export.completed` and `tenant_export.failed`; signatures use HMAC-SHA256 in `x-ziozen-signature`. Webhook administration was tightened to prevent cross-organization configuration visibility.

Validation passed: API build, web build, Redis-backed export e2e coverage with 3 passing tests, including queued completion, history/download, safe serialization, and signed webhook delivery.
