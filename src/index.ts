import api from "./api";
import { appConfig } from "./config";
import { startCronJobs } from "./cron";

console.log("🍉 MelonScout Backend starting...");

startCronJobs();

export default {
  port: appConfig.server.port,
  fetch: api.fetch,
};

console.log(`🚀 Server running at http://localhost:${appConfig.server.port}`);
