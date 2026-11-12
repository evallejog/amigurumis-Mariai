import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mariai-auth-'));
const dbPath = path.join(temp, 'auth.db');
const port = 53000 + Math.floor(Math.random() * 8000);
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts', '--port', String(port)], { env: { ...process.env, DATABASE_PATH: dbPath, PORT: String(port), SEED_DEMO_DATA: 'false', NODE_ENV: 'test' }, stdio: 'ignore' });
const origin = { Origin: base };
async function ready() { for (let i = 0; i < 80; i++) { try { if ((await fetch(`${base}/api/health`)).ok) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 125)); } throw new Error('server not ready'); }
function cookieOf(response: Response) { const header = response.headers.get('set-cookie'); assert.ok(header); return header!.split(';', 1)[0]; }
try {
  await ready();
  const registration = await fetch(`${base}/api/auth/register`, { method: 'POST', headers: { ...origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName: 'Cookie User', email: 'cookie@example.test', password: 'secret123' }) });
  assert.equal(registration.status, 201);
  const registerCookie = cookieOf(registration);
  assert.match(registration.headers.get('set-cookie')!, /HttpOnly/i);
  assert.match(registration.headers.get('set-cookie')!, /SameSite=Lax/i);
  assert.doesNotMatch(registration.headers.get('set-cookie')!, /Secure/i);
  assert.equal((await registration.json() as any).token, undefined);
  assert.equal((await fetch(`${base}/api/auth/me`, { headers: { Cookie: registerCookie } })).status, 200);
  const logout = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { ...origin, Cookie: registerCookie } });
  assert.equal(logout.status, 200);
  assert.equal((await fetch(`${base}/api/auth/me`, { headers: { Cookie: registerCookie } })).status, 401);
  assert.equal((await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { Cookie: registerCookie } })).status, 403);
  assert.equal((await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { Cookie: registerCookie, Origin: 'https://attacker.invalid' } })).status, 403);

  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { ...origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'cookie@example.test', password: 'secret123' }) });
  assert.equal(login.status, 200);
  const loginCookie = cookieOf(login);
  assert.equal((await fetch(`${base}/api/auth/me`, { headers: { Cookie: loginCookie } })).status, 200);

  const database = new Database(dbPath);
  database.prepare("INSERT INTO users (id,name,email,role,created_at) VALUES ('admin-cookie','Admin','admin-cookie@example.test','admin',?)").run(new Date().toISOString());
  database.prepare('INSERT INTO sessions (token,user_id,created_at,expires_at) VALUES (?,?,?,?)').run('cookie-admin-token', 'admin-cookie', new Date().toISOString(), new Date(Date.now() + 60_000).toISOString());
  database.prepare('INSERT INTO sessions (token,user_id,created_at,expires_at) VALUES (?,?,?,?)').run('cookie-expired-token', 'admin-cookie', new Date().toISOString(), new Date(Date.now() - 60_000).toISOString());
  database.close();
  const customer = loginCookie;
  assert.equal((await fetch(`${base}/api/admin/analytics/sales?period=7`, { headers: { Cookie: customer } })).status, 403);
  assert.equal((await fetch(`${base}/api/admin/ml/status`)).status, 401);
  assert.equal((await fetch(`${base}/api/admin/ml/status`, { headers: { Cookie: 'amigurumis_mariai_session=cookie-admin-token' } })).status, 200);
  assert.equal((await fetch(`${base}/api/admin/analytics/sales?period=7`, { headers: { Cookie: 'amigurumis_mariai_session=cookie-admin-token' } })).status, 200);
  assert.equal((await fetch(`${base}/api/admin/overview`)).status, 401);
  assert.equal((await fetch(`${base}/api/admin/overview`, { headers: { Cookie: 'amigurumis_mariai_session=cookie-expired-token' } })).status, 401);
  const cleanupCheck = new Database(dbPath, { readonly: true });
  assert.equal((cleanupCheck.prepare("SELECT count(*) n FROM sessions WHERE token='cookie-expired-token'").get() as any).n, 0);
  cleanupCheck.close();

  const seeded = new Database(dbPath);
  seeded.prepare("INSERT INTO products (id,sku,name,category,short_description,full_description,price,currency,stock_units,low_stock_threshold,status,image_url,created_at,updated_at) VALUES ('auth-product','AUTH-1','Auth plush','test','short','full',15000,'COP',2,1,'published','/x',?,?)").run(new Date().toISOString(), new Date().toISOString());
  seeded.close();
  const checkedOut = await fetch(`${base}/api/orders`, { method: 'POST', headers: { ...origin, Cookie: loginCookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ customer: { fullName: 'Cookie User', email: 'cookie@example.test' }, shippingMethod: 'pickup', items: [{ product: { id: 'auth-product', price: 1 }, quantity: 1 },], subtotal: 1 }) });
  assert.equal(checkedOut.status, 201);
  const order = await checkedOut.json() as any;
  assert.equal(order.subtotal, 15000);
  assert.equal((await fetch(`${base}/api/orders/my-orders`, { headers: { Cookie: loginCookie } })).status, 200);
  assert.equal((await fetch(`${base}/api/orders/${order.id}/pdf`, { headers: { Cookie: loginCookie } })).status, 200);
  assert.equal((await fetch(`${base}/api/orders/${order.id}/pdf`)).status, 403);
  console.log('Cookie auth and CSRF integration checks passed.');
} finally {
  if (child.exitCode === null) { const exited = new Promise<void>((resolve) => child.once('exit', () => resolve())); child.kill(); await exited; }
  fs.rmSync(temp, { recursive: true, force: true, maxRetries: 5 });
}
