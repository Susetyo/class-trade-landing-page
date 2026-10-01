import { config } from "dotenv";

// DB-backed tests (idempotency, consent, reconciliation) run against
// the same DATABASE_URL used for local development — see
// docs/security-reliability.md "Testing" section. No test ever calls
// a real Midtrans/Telegram/error-monitoring endpoint: those are always
// mocked with `vi.mock`.
config({ path: ".env.local" });

process.env.ERROR_MONITORING_ENABLED = "false";
