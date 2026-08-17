const test = require('node:test');
const assert = require('node:assert');

const { createPollingWatchdog } = require('../pollingWatchdog');

const silent = { error() {}, warn() {}, log() {} };

// A poll that never comes back. This is the production failure from 2026-08-10:
// the long-poll request sat on a half-open TCP socket forever, so the polling
// loop never scheduled another cycle and nothing was ever logged.
const hangingBot = () => ({ getUpdates: () => new Promise(() => {}) });

test('trips when no polling cycle settles within the stall limit', () => {
  let clock = 1000;
  const stalls = [];
  const bot = hangingBot();
  const watchdog = createPollingWatchdog(bot, {
    stallLimitMs: 60000,
    now: () => clock,
    onStall: (status) => stalls.push(status),
    logger: silent,
  });

  bot.getUpdates({});

  clock += 30000;
  watchdog.check();
  assert.equal(stalls.length, 0, 'must not trip before the limit');

  clock += 31000;
  watchdog.check();
  assert.equal(stalls.length, 1, 'must trip once past the limit');

  clock += 60000;
  watchdog.check();
  assert.equal(stalls.length, 1, 'must not trip repeatedly once it has fired');
});

test('a resolved poll refreshes liveness', async () => {
  let clock = 1000;
  const stalls = [];
  const bot = { getUpdates: () => Promise.resolve([{ update_id: 7 }]) };
  const watchdog = createPollingWatchdog(bot, {
    stallLimitMs: 60000,
    now: () => clock,
    onStall: (status) => stalls.push(status),
    logger: silent,
  });

  clock += 59000;
  const updates = await bot.getUpdates({});
  assert.deepEqual(updates, [{ update_id: 7 }], 'must pass the resolved value through untouched');

  clock += 30000;
  watchdog.check();
  assert.equal(stalls.length, 0, 'a settled poll 30s ago is healthy');
});

// The error log on dev-server held 249x 502 and 52x 429 over five months. Those
// are transient and the library recovers on its own, so they must never be
// mistaken for a stall - restarting on them would turn noise into an outage.
test('a rejected poll still counts as alive, and the rejection propagates', async () => {
  let clock = 1000;
  const stalls = [];
  const bot = {
    getUpdates: () => Promise.reject(new Error('ETELEGRAM: 502 Bad Gateway')),
  };
  const watchdog = createPollingWatchdog(bot, {
    stallLimitMs: 60000,
    now: () => clock,
    onStall: (status) => stalls.push(status),
    logger: silent,
  });

  clock += 59000;
  await assert.rejects(() => bot.getUpdates({}), /502 Bad Gateway/, 'caller must still see the error');

  clock += 30000;
  watchdog.check();
  assert.equal(stalls.length, 0, 'an erroring-but-turning poll loop is alive');
});

test('status reports staleness for the health endpoint', () => {
  let clock = 1000;
  const watchdog = createPollingWatchdog(hangingBot(), {
    stallLimitMs: 60000,
    now: () => clock,
    onStall: () => {},
    logger: silent,
  });

  assert.equal(watchdog.status().healthy, true);

  clock += 90000;
  const status = watchdog.status();
  assert.equal(status.healthy, false);
  assert.equal(status.msSinceLastPoll, 90000);
});

test('start/stop manage the interval without holding the process open', () => {
  const watchdog = createPollingWatchdog(hangingBot(), {
    stallLimitMs: 60000,
    checkIntervalMs: 10,
    onStall: () => {},
    logger: silent,
  });

  watchdog.start();
  watchdog.start(); // idempotent
  watchdog.stop();
  assert.ok(true, 'start/stop did not throw');
});
