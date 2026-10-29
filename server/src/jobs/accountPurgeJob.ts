import { accountService } from "../services/accountService.js";

const HOUR_MS = 60 * 60 * 1000;

export function startAccountPurgeJob() {
  const run = async () => {
    try {
      const purged = await accountService.purgeExpiredAccounts();
      if (purged > 0) {
        console.log(`Purged ${purged} account(s) after the 30-day deletion window.`);
      }
    } catch (error) {
      console.error("Account purge job failed:", error);
    }
  };

  void run();
  return setInterval(() => {
    void run();
  }, HOUR_MS);
}
