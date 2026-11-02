import { createApp } from "./app";
import { env } from "./env";
import { failStaleAudits } from "./jobs/queue";

await failStaleAudits();

createApp().listen(env.API_PORT, () => {
  console.log(`SiteScope API listening on http://localhost:${env.API_PORT} (mock mode: ${env.AUDIT_MOCK_MODE})`);
});
