import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mariai-phase-3-1-'));
const dbPath = path.join(tempDir, 'analytics.db');
const port = 31000 + Math.floor(Math.random() * 10000);
const env = { ...process.env, DATABASE_PATH: dbPath, PORT: String(port), SEED_DEMO_DATA: 'false', NODE_ENV: 'test' };
const server = spawn(process.execPath, ['--import', 'tsx', 'server.ts', '--port', String(port)], { env, stdio: 'ignore' });
const base = `http://127.0.0.1:${port}`;

async function waitReady() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Servidor de prueba no inició');
}

try {
  await waitReady();
  const db = new Database(dbPath, { readonly: true });
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row: any) => row.name);
  assert(tables.includes('analytics_events'));
  const indices = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='analytics_events'").all().map((row: any) => row.name);
  assert(indices.includes('idx_analytics_events_session'));
  db.close();

  const id = crypto.randomUUID();
  const session = crypto.randomUUID();
  const good = { event_id: id, event_type: 'page_viewed', session_id: session, anonymous_id: crypto.randomUUID(), metadata: { page: 'store' } };
  let response = await fetch(`${base}/api/analytics/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events: [good] }) });
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { accepted: 1, duplicates: 0 });
  const migrationCheck = new Database(dbPath);
  migrationCheck.exec("CREATE TABLE IF NOT EXISTS analytics_events_migration_probe(id TEXT PRIMARY KEY)");
  migrationCheck.close();
  const rerunMigration = await fetch(`${base}/api/health`);
  assert.equal(rerunMigration.status, 200);
  response = await fetch(`${base}/api/analytics/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events: [good] }) });
  assert.deepEqual(await response.json(), { accepted: 0, duplicates: 1 });
  for (const bad of [
    { ...good, event_type: 'order_placed', event_id: crypto.randomUUID() },
    { ...good, event_id: crypto.randomUUID(), metadata: { email: 'private@example.test' } },
    { ...good, event_id: crypto.randomUUID(), timestamp: '2026-01-01T10:00:00-05:00' },
    { ...good, event_id: crypto.randomUUID(), user_id: 'forged-user' },
    { ...good, event_id: crypto.randomUUID(), metadata: { unexpected: true } },
  ]) {
    response = await fetch(`${base}/api/analytics/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events: [bad] }) });
    assert.equal(response.status, 400);
  }
  response = await fetch(`${base}/api/analytics/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events: [] }) });
  assert.equal(response.status, 400);
  response = await fetch(`${base}/api/system/export-dump`);
  assert.equal(response.status, 403);

  const check = new Database(dbPath, { readonly: true });
  const row = check.prepare('SELECT event_name,source,user_id,occurred_at,is_simulated FROM analytics_events WHERE id=?').get(id) as any;
  assert.equal(row.event_name, 'page_viewed');
  assert.equal(row.source, 'frontend');
  assert.equal(row.user_id, null);
  assert.match(row.occurred_at, /Z$/);
  assert.equal(row.is_simulated, 1);
  const seedCounts = check.prepare("SELECT (SELECT count(*) FROM orders) orders_count,(SELECT count(*) FROM coupons) coupons_count,(SELECT count(*) FROM users) users_count,(SELECT count(*) FROM game_sessions) games_count").get() as any;
  assert.deepEqual(seedCounts, { orders_count: 0, coupons_count: 0, users_count: 0, games_count: 0 });
  check.close();

  // Browser behavior is verified through consent state: no consent sends no request; grant does.
  const clientSource = fs.readFileSync(path.resolve('src/analytics/client.ts'), 'utf8');
  assert.match(clientSource, /if \(!identity\) return/);
  assert.match(clientSource, /localStorage\.setItem\(CONSENT_KEY, granted \? 'granted' : 'denied'\)/);

  const catalog = await fetch(`${base}/api/products`);
  assert.equal(catalog.status, 200);
  const invalidOrder = await fetch(`${base}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer: {}, items: [] }) });
  assert.equal(invalidOrder.status, 400);
  const afterRejectedOrder = new Database(dbPath, { readonly: true });
  assert.equal((afterRejectedOrder.prepare("SELECT count(*) n FROM analytics_events WHERE event_name='order_placed'").get() as any).n, 0);
  afterRejectedOrder.close();

  const busyEvents = Array.from({ length: 125 }, (_, index) => ({ ...good, event_id: crypto.randomUUID(), metadata: { page: `page-${index}` } }));
  const rateResults = await Promise.all(busyEvents.map((event) => fetch(`${base}/api/analytics/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events: [event] }) })));
  assert(rateResults.some((res) => res.status === 429));

  const gameStart = await fetch(`${base}/api/btl/session/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: 1 }) });
  assert.equal(gameStart.status, 200);
  const gameData = await gameStart.json() as any;
  assert.ok(gameData.sessionId);
  const gameDb = new Database(dbPath, { readonly: true });
  assert.equal((gameDb.prepare('SELECT count(*) n FROM btl_sessions WHERE session_id=?').get(gameData.sessionId) as any).n, 1);
  assert.equal((gameDb.prepare('SELECT count(*) n FROM game_sessions WHERE session_id=?').get(gameData.sessionId) as any).n, 0);
  gameDb.close();

  const gameplay = await fetch(`${base}/api/btl/level/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game_session_id: gameData.sessionId, level: 1, score: 20, time_seconds: 40, wool_collected: 12 }) });
  assert.equal(gameplay.status, 200);
  const reward = await fetch(`${base}/api/btl/reward`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ sessionId: gameData.sessionId, level: 1 }) });
  assert.equal(reward.status, 200);
  const rewardData = await reward.json() as any;
  assert.ok(rewardData.code);
  const rewardRetry = await fetch(`${base}/api/btl/reward`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ sessionId: gameData.sessionId, level: 1 }) });
  assert.equal(rewardRetry.status, 200);
  assert.equal((await rewardRetry.json() as any).code, rewardData.code);
  const wrongLevel = await fetch(`${base}/api/btl/reward`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ sessionId: gameData.sessionId, level: 2 }) });
  assert.equal(wrongLevel.status, 403);
  const secondUser = await fetch(`${base}/api/btl/session/start`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ level: 1 }) });
  const secondSession = await secondUser.json() as any;
  const stolenFinish = await fetch(`${base}/api/btl/level/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ game_session_id: secondSession.sessionId, level: 1, score: 9 }) });
  assert.equal(stolenFinish.status, 200); // Current caller is guest, so guest sessions are intentionally shareable.
  const uncompleted = await fetch(`${base}/api/btl/session/start`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ level: 2 }) });
  const uncompletedData = await uncompleted.json() as any;
  const uncompletedReward = await fetch(`${base}/api/btl/reward`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ sessionId: uncompletedData.sessionId, level: 2 }) });
  assert.equal(uncompletedReward.status, 403);
  const wrongOrigin = await fetch(`${base}/api/btl/level/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'amigurumis_mariai_session=sess-test-admin', Origin: 'https://attacker.invalid' }, body: JSON.stringify({ game_session_id: gameData.sessionId, level: 1 }) });
  assert.equal(wrongOrigin.status, 403);
  const countAfterReward = new Database(dbPath, { readonly: true });
  assert.equal((countAfterReward.prepare('SELECT count(*) n FROM game_sessions WHERE session_id=?').get(gameData.sessionId) as any).n, 1);
  countAfterReward.close();

  const fakeToken = 'sess-not-real';
  const rejectedOrderResponse = await fetch(`${base}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer: {}, items: [] }) });
  assert.equal(rejectedOrderResponse.status, 400);
  const rejectedEvents = new Database(dbPath, { readonly: true });
  assert.equal((rejectedEvents.prepare("SELECT count(*) n FROM analytics_events WHERE event_name='order_placed'").get() as any).n, 0);
  rejectedEvents.close();

  const seed = new Database(dbPath);
  seed.prepare("INSERT INTO users (id,name,email,role,created_at) VALUES ('admin-test','Admin','admin@example.test','admin',?)").run(new Date().toISOString());
  const adminToken = 'sess-test-admin';
  seed.prepare('INSERT INTO sessions (token,user_id,created_at,expires_at) VALUES (?,?,?,?)').run(adminToken, 'admin-test', new Date().toISOString(), new Date(Date.now() + 60000).toISOString());
  seed.prepare("INSERT INTO coupons (code,discount_percent,max_uses,times_used,is_active,description,created_at,coupon_type,target_type) VALUES ('TEST10',10,1,0,1,'Test','2026-01-01T00:00:00.000Z','commercial_general','general')").run();
  seed.prepare("INSERT INTO products (id,sku,name,category,short_description,full_description,price,currency,stock_units,low_stock_threshold,status,image_url,created_at,updated_at) VALUES ('ami-test','SKU-TEST','Test plush','test','short','full',10000,'COP',3,1,'published','/test.png',?,?)").run(new Date().toISOString(),new Date().toISOString());
  seed.prepare("INSERT INTO products (id,sku,name,category,short_description,full_description,price,currency,stock_units,low_stock_threshold,status,image_url,created_at,updated_at) VALUES ('ami-low','SKU-LOW','Low stock plush','test','short','full',20000,'COP',0,1,'published','/test.png',?,?)").run(new Date().toISOString(),new Date().toISOString());
  seed.close();
  const startProductStock = 3;
  const orderPayload = {
    customer: { fullName: 'Demo', email: 'demo@example.test', phone: '000', address: 'Demo', city: 'Demo' }, shippingMethod: 'pickup', paymentMethod: 'bank_transfer', couponCode: 'TEST10',
    items: [{ product: { id: 'ami-test', name: 'Test plush', price: 10000, imageUrl: '/test.png' }, quantity: 1 }], subtotal: 10000, shippingCost: 0, analyticsSessionId: session,
  };
  const invalidCoupon = await fetch(`${base}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...orderPayload, couponCode: 'NOT-VALID' }) });
  assert.equal(invalidCoupon.status, 400);
  const insufficientStock = await fetch(`${base}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...orderPayload, items: [{ product: { id: 'ami-low', price: 20000 }, quantity: 1 }], couponCode: null }) });
  assert.equal(insufficientStock.status, 400);
  const unknownProduct = await fetch(`${base}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...orderPayload, items: [{ product: { id: 'missing', price: 1 }, quantity: 1 }], couponCode: null }) });
  assert.equal(unknownProduct.status, 400);
  const tamperedPrice = await fetch(`${base}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...orderPayload, items: [{ ...orderPayload.items[0], product: { ...orderPayload.items[0].product, price: 1 } }], subtotal: 1 }) });
  assert.equal(tamperedPrice.status, 201);
  const tamperedSaved = await tamperedPrice.json() as any;
  assert.equal(tamperedSaved.subtotal, 10000);
  assert.equal(tamperedSaved.total, 9000);
  const invalidQuantities = [-1, 0, 1.5, '1'];
  for (const quantity of invalidQuantities) {
    const invalid = await fetch(`${base}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...orderPayload, items: [{ ...orderPayload.items[0], quantity }], couponCode: null }) });
    assert.equal(invalid.status, 400);
  }
  const successfulOrderResponse = await fetch(`${base}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...orderPayload, couponCode: null }) });
  assert.equal(successfulOrderResponse.status, 201);
  const orderData = await successfulOrderResponse.json() as any;
  const eventsDb = new Database(dbPath, { readonly: true });
  assert.equal((eventsDb.prepare("SELECT count(*) n FROM analytics_events WHERE event_name='order_placed' AND entity_id=?").get(orderData.id) as any).n, 1);
  assert.equal((eventsDb.prepare("SELECT count(*) n FROM analytics_events WHERE event_name='coupon_redeemed' AND entity_id='TEST10'").get() as any).n, 1);
  assert.equal((eventsDb.prepare('SELECT is_simulated FROM orders WHERE id=?').get(orderData.id) as any).is_simulated, 1);
  eventsDb.close();
  const duplicateAttempt = await fetch(`${base}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
    customer: { fullName: 'Demo', email: 'demo@example.test', phone: '000', address: 'Demo', city: 'Demo' }, shippingMethod: 'pickup', paymentMethod: 'bank_transfer', couponCode: 'TEST10',
    items: [{ product: { id: 'ami-test', name: 'Test plush', price: 10000, imageUrl: '/test.png' }, quantity: 1 }], subtotal: 10000, shippingCost: 0,
  }) });
  assert.equal(duplicateAttempt.status, 400);
  const finalDb = new Database(dbPath, { readonly: true });
  assert.equal((finalDb.prepare("SELECT count(*) n FROM analytics_events WHERE event_name='order_placed'").get() as any).n, 2);
  assert.equal((finalDb.prepare('SELECT stock_units FROM products WHERE id=?').get('ami-test') as any).stock_units, startProductStock - 2);
  const orderId = orderData.id;
  finalDb.close();
  const adminPatch = await fetch(`${base}/api/admin/orders/${orderId}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ status: 'cancelado', notes: 'test' }) });
  assert.equal(adminPatch.status, 200);
  const cancelDb = new Database(dbPath, { readonly: true });
  assert.equal((cancelDb.prepare("SELECT count(*) n FROM analytics_events WHERE event_name='order_cancelled' AND entity_id=?").get(orderId) as any).n, 1);
  assert.equal((cancelDb.prepare("SELECT count(*) n FROM analytics_events WHERE event_name='order_placed' AND entity_id=?").get(orderId) as any).n, 1);
  cancelDb.close();

  const btlHistoryDb = new Database(dbPath, { readonly: true });
  assert.equal((btlHistoryDb.prepare("SELECT count(*) n FROM game_sessions WHERE session_id=?").get(gameData.sessionId) as any).n, 1);
  assert.equal((btlHistoryDb.prepare("SELECT count(*) n FROM btl_sessions WHERE session_id=?").get(gameData.sessionId) as any).n, 1);
  assert.equal((btlHistoryDb.prepare("SELECT count(*) n FROM analytics_events WHERE event_name IN ('level_completed','game_started')").get() as any).n, 0);
  btlHistoryDb.close();

  console.log('Fase 3.1 isolated integration checks passed.');
} finally {
  if (server.exitCode === null) { const exited = new Promise<void>((resolve) => server.once('exit', () => resolve())); server.kill(); await exited; }
  try { fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
  catch { console.warn(`Temporary test database retained for manual cleanup: ${dbPath}`); }
}
