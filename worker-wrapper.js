// Wrapper worker that adds scheduled event handling to OpenNext worker
import openNextWorker from './.open-next/worker.js';

export * from './.open-next/worker.js';

export default {
  // HTTP requests - delegate to OpenNext
  async fetch(request, env, ctx) {
    return openNextWorker.fetch(request, env, ctx);
  },

  // Cron trigger - call the sync API, then save snapshot
  async scheduled(event, env, ctx) {
    const baseUrl = env.WORKER_URL || 'https://skills.hot';
    const syncUrl = `${baseUrl}/api/cron/sync-external-skills`;
    const snapshotUrl = `${baseUrl}/api/cron/save-snapshot`;

    console.log(`[Cron] Triggering sync at ${new Date().toISOString()}`);

    try {
      // Step 1: Sync external skills
      const syncResponse = await fetch(syncUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Cloudflare-Cron/1.0',
        },
      });

      const syncResult = await syncResponse.json();
      console.log(`[Cron] Sync result:`, syncResult);

      // Step 2: Save snapshot (only if sync succeeded)
      if (syncResponse.ok) {
        console.log(`[Cron] Triggering snapshot save...`);
        const snapshotResponse = await fetch(snapshotUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Cloudflare-Cron/1.0',
          },
        });

        const snapshotResult = await snapshotResponse.json();
        console.log(`[Cron] Snapshot result:`, snapshotResult);
      }
    } catch (error) {
      console.error(`[Cron] Cron job failed:`, error);
    }
  },
};
