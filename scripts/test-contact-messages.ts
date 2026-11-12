import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mariai-contact-'));
const dbPath = path.join(temp, 'contact.db'); const port = 54000 + Math.floor(Math.random() * 7000); const base = `http://127.0.0.1:${port}`; const origin = { Origin: base };
const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts', '--port', String(port)], { env: { ...process.env, DATABASE_PATH: dbPath, PORT: String(port), SEED_DEMO_DATA: 'false', NODE_ENV: 'test' }, stdio: 'ignore' });
async function ready() { for (let attempt = 0; attempt < 80; attempt++) { try { if ((await fetch(`${base}/api/health`)).ok) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 125)); } throw new Error('server not ready'); }
try {
  await ready();
  const body = { name: 'Consulta de prueba', email: 'contacto@example.test', subject: 'Diseño especial', message: 'Quisiera consultar disponibilidad.' };
  const sent = await fetch(`${base}/api/contact/messages`, { method: 'POST', headers: { ...origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal(sent.status, 201); const created = await sent.json() as any; assert.equal(created.received, true);
  assert.equal((await fetch(`${base}/api/contact/messages`, { method: 'POST', headers: { ...origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).status, 409);
  assert.equal((await fetch(`${base}/api/contact/messages`, { method: 'POST', headers: { ...origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, email: 'incorrecto' }) })).status, 400);
  assert.equal((await fetch(`${base}/api/contact/messages`, { method: 'POST', headers: { ...origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, message: 'x'.repeat(4001), email: 'other@example.test' }) })).status, 400);
  assert.equal((await fetch(`${base}/api/admin/contact-messages`)).status, 401);
  const db = new Database(dbPath); db.prepare("INSERT INTO users (id,name,email,role,created_at) VALUES ('contact-admin','Admin','admin@example.test','admin',?)").run(new Date().toISOString()); db.prepare('INSERT INTO sessions (token,user_id,created_at,expires_at) VALUES (?,?,?,?)').run('contact-admin-token','contact-admin',new Date().toISOString(),new Date(Date.now()+60000).toISOString()); db.close();
  const cookie = 'amigurumis_mariai_session=contact-admin-token';
  const listed = await fetch(`${base}/api/admin/contact-messages`, { headers: { Cookie: cookie } }); assert.equal(listed.status, 200); const messages = (await listed.json() as any).messages; assert.equal(messages.length, 1); assert.equal(messages[0].message, body.message);
  assert.equal((await fetch(`${base}/api/admin/contact-messages/${created.id}/status`, { method: 'PATCH', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'read' }) })).status, 403);
  assert.equal((await fetch(`${base}/api/admin/contact-messages/${created.id}/status`, { method: 'PATCH', headers: { ...origin, Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'read' }) })).status, 200);
  const persisted = new Database(dbPath, { readonly: true }); assert.equal((persisted.prepare('SELECT status FROM contact_messages WHERE id = ?').get(created.id) as any).status, 'read'); persisted.close();
  console.log('Integración de mensajes de contacto aprobada.');
} finally { if (child.exitCode === null) { const exited = new Promise<void>((resolve) => child.once('exit', () => resolve())); child.kill(); await exited; } fs.rmSync(temp, { recursive: true, force: true, maxRetries: 5 }); }
