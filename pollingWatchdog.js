/**
 * Liveness watchdog for the Telegram long-polling loop.
 *
 * Why this exists
 * ---------------
 * On 2026-08-10 the bot went deaf for seven days while PM2 reported it "online".
 * node-telegram-bot-api issues its getUpdates long-poll with no socket timeout,
 * so when the TCP connection to api.telegram.org died silently (half-open: no
 * FIN, no RST) the request stayed pending forever. The polling loop schedules
 * the next cycle in a .finally() handler, so a request that never settles means
 * the loop simply stops - no crash, no exception, nothing logged. The Express
 * health server kept answering, so PM2's autorestart never fired.
 *
 * The request timeout in bot.js is the primary fix. This watchdog is the
 * backstop: it notices that no polling cycle has settled recently and exits so
 * PM2 brings up a fresh process, regardless of what caused the stall.
 *
 * Liveness is "a poll cycle settled", not "a poll cycle succeeded". A rejected
 * poll still proves the loop is turning, and transient failures are routine on
 * this path (249x 502 and 52x 429 in five months of logs). Treating those as a
 * stall would convert recoverable noise into a restart loop.
 */

const DEFAULT_STALL_LIMIT_MS = 5 * 60 * 1000;
const DEFAULT_CHECK_INTERVAL_MS = 60 * 1000;

/**
 * Wraps bot.getUpdates so every settled cycle refreshes a timestamp, then
 * watches that timestamp for staleness.
 *
 * @param {Object} bot                      TelegramBot instance (needs .getUpdates)
 * @param {Object} [options]
 * @param {number} [options.stallLimitMs]   How long without a settled poll counts as stalled
 * @param {number} [options.checkIntervalMs] How often start() re-checks
 * @param {Function} [options.now]          Clock, injectable for tests
 * @param {Function} [options.onStall]      Called once when stalled; defaults to process exit
 * @param {Object} [options.logger]         Defaults to console
 * @returns {{start: Function, stop: Function, check: Function, status: Function}}
 */
function createPollingWatchdog(bot, options = {}) {
  const stallLimitMs = options.stallLimitMs || DEFAULT_STALL_LIMIT_MS;
  const checkIntervalMs = options.checkIntervalMs || DEFAULT_CHECK_INTERVAL_MS;
  const now = options.now || Date.now;
  const logger = options.logger || console;
  const onStall = options.onStall || (() => process.exit(1));

  let lastPollSettledAt = now();
  let timer = null;
  let tripped = false;

  const originalGetUpdates = bot.getUpdates.bind(bot);

  bot.getUpdates = function watchedGetUpdates(...args) {
    // Promise.resolve().then(...) so a synchronous throw becomes a rejection and
    // still refreshes liveness rather than escaping past the .finally().
    return Promise.resolve()
      .then(() => originalGetUpdates(...args))
      .finally(() => {
        lastPollSettledAt = now();
      });
  };

  function status() {
    const msSinceLastPoll = now() - lastPollSettledAt;
    return {
      lastPollSettledAt: new Date(lastPollSettledAt).toISOString(),
      msSinceLastPoll,
      stallLimitMs,
      healthy: msSinceLastPoll <= stallLimitMs,
    };
  }

  function check() {
    const current = status();
    if (current.healthy || tripped) {
      return current;
    }

    tripped = true;
    logger.error(
      `[watchdog] no polling cycle has settled for ${Math.round(current.msSinceLastPoll / 1000)}s ` +
        `(limit ${Math.round(stallLimitMs / 1000)}s) - exiting so PM2 starts a fresh poller`
    );
    onStall(current);
    return current;
  }

  return {
    start() {
      if (timer) return;
      timer = setInterval(check, checkIntervalMs);
      // Never let the watchdog itself be the reason the process stays alive.
      if (typeof timer.unref === 'function') timer.unref();
    },
    stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    },
    check,
    status,
  };
}

module.exports = {
  createPollingWatchdog,
  DEFAULT_STALL_LIMIT_MS,
  DEFAULT_CHECK_INTERVAL_MS,
};
