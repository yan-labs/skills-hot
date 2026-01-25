// Wrapper worker that adds scheduled event handling to OpenNext worker
import openNextWorker from './.open-next/worker.js';

export * from './.open-next/worker.js';

export default {
  // HTTP requests - delegate to OpenNext
  async fetch(request, env, ctx) {
    return openNextWorker.fetch(request, env, ctx);
  },

  // Cron trigger - call the sync API
  async scheduled(event, env, ctx) {
    const baseUrl = env.WORKER_URL || 'https://skillbank.dev';
    const syncUrl = `${baseUrl}/api/cron/sync-skills-sh`;

    console.log(`[Cron] Triggering sync at ${new Date().toISOString()}`);

    try {
      const response = await fetch(syncUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Cloudflare-Cron/1.0',
        },
      });

      const result = await response.json();
      console.log(`[Cron] Sync result:`, result);
    } catch (error) {
      console.error(`[Cron] Sync failed:`, error);
    }
  },
};
