const test = require('node:test');
const assert = require('node:assert');
const net = require('node:net');

const TelegramBot = require('node-telegram-bot-api');

// Accepts the TCP connection, reads the request, and never answers.
// This reproduces what dev-server's socket to api.telegram.org looked like on
// 2026-08-10: ESTAB, zero bytes queued either way, no response, indefinitely.
function startBlackHole() {
  return new Promise((resolve) => {
    const sockets = [];
    const server = net.createServer((socket) => {
      sockets.push(socket);
      socket.resume(); // consume the request, answer nothing
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({
        port: server.address().port,
        close: () => {
          sockets.forEach((s) => s.destroy());
          server.close();
        },
      });
    });
  });
}

const makeBot = (port, requestOptions) =>
  new TelegramBot('123456:FAKE-TOKEN-FOR-TESTS', {
    polling: false,
    baseApiUrl: `http://127.0.0.1:${port}`,
    request: requestOptions,
  });

test('a long-poll against an unresponsive server aborts instead of hanging', async () => {
  const blackHole = await startBlackHole();
  try {
    const bot = makeBot(blackHole.port, { timeout: 1500 });

    const startedAt = Date.now();
    await assert.rejects(() => bot.getUpdates({ timeout: 0 }), 'the request must fail, not hang');
    const elapsed = Date.now() - startedAt;

    assert.ok(
      elapsed < 8000,
      `expected the abort near the 1500ms timeout, but it took ${elapsed}ms`
    );
  } finally {
    blackHole.close();
  }
});

// Documents the defect itself: with no request timeout configured - which is how
// bot.js ran until this change - the same call never settles.
test('without a request timeout the same call hangs (the 2026-08-10 failure mode)', async () => {
  const blackHole = await startBlackHole();
  try {
    const bot = makeBot(blackHole.port, undefined);

    const HANG_WINDOW_MS = 2500;
    const settled = await Promise.race([
      bot.getUpdates({ timeout: 0 }).then(() => 'settled', () => 'settled'),
      new Promise((resolve) => setTimeout(() => resolve('still-hanging'), HANG_WINDOW_MS)),
    ]);

    assert.equal(
      settled,
      'still-hanging',
      'the unfixed configuration is expected to hang - that is the bug being fixed'
    );
  } finally {
    blackHole.close();
  }
});
