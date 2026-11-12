import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { spawn } from 'node:child_process';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mariai-phase-3-2-')); const dbPath = path.join(tempDir, 'analytics.db');
const port = 41000 + Math.floor(Math.random() * 10000); const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['--import', 'tsx', 'server.ts', '--port', String(port)], { env: { ...process.env, DATABASE_PATH: dbPath, PORT: String(port), SEED_DEMO_DATA: 'false', NODE_ENV: 'test' }, stdio: 'ignore' });
const day = '2026-11-10T12:00:00.000Z';
async function ready() { for (let i=0;i<80;i++) { try { if ((await fetch(`${base}/api/health`)).ok) return; } catch {} await new Promise(r => setTimeout(r, 125)); } throw new Error('Servidor de prueba no inició'); }
try {
  await ready(); const db = new Database(dbPath);
  db.prepare("INSERT INTO users(id,name,email,role,created_at) VALUES ('admin','Admin','admin@test.local','admin',?),('buyer','Buyer','buyer@test.local','customer',?),('customer','Customer','customer@test.local','customer',?)").run(day, day, day);
  db.prepare("INSERT INTO sessions(token,user_id,created_at,expires_at) VALUES ('admin-token','admin',?,?)").run(day, '2027-01-01T00:00:00.000Z');
  db.prepare("INSERT INTO sessions(token,user_id,created_at,expires_at) VALUES ('customer-token','customer',?,?)").run(day, '2027-01-01T00:00:00.000Z');
  db.prepare("INSERT INTO products(id,sku,name,category,short_description,full_description,price,stock_units,low_stock_threshold,status,image_url,created_at,updated_at) VALUES ('p1','P1','Producto público','x','x','x',10000,1,1,'published','/x',?,?)").run(day,day);
  const order = db.prepare("INSERT INTO orders(id,order_number,user_id,customer_name,customer_email,customer_phone,customer_address,customer_city,shipping_method,payment_method,subtotal,shipping_cost,discount,total,status,created_at,coupon_code,is_simulated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)");
  order.run('o1','O1','buyer','Private Name','private@test.local','1','addr','city','x','x',10000,0,1000,9000,'entregado',day,'BTL1'); order.run('o2','O2','buyer','Other','other@test.local','1','addr','city','x','x',20000,0,0,20000,'cancelado',day,null);
  db.prepare("INSERT INTO order_items(id,order_id,product_id,product_name,price,quantity) VALUES ('i1','o1','p1','Producto público',10000,1)").run();
  db.prepare("INSERT INTO coupons(code,discount_percent,max_uses,times_used,is_active,created_at,coupon_type,target_type) VALUES ('BTL1',10,1,1,1,?,'btl','exclusive')").run(day);
  db.prepare("INSERT INTO btl_sessions(session_id,level,status,created_at) VALUES ('s1',1,'finished',?)").run(day); db.prepare("INSERT INTO game_sessions(session_id,level,score,wool_collected,time_seconds,victory,created_at) VALUES ('s1',1,5,2,3,1,?)").run(day);
  const event = db.prepare("INSERT INTO analytics_events(id,event_name,event_version,session_id,source,entity_type,entity_id,properties,occurred_at,received_at,is_simulated) VALUES (?,?, '1.0.0','sess-1','frontend',?,?, '{}',?,?,1)");
  for (const name of ['product_viewed','cart_item_added','checkout_started']) event.run(`e-${name}`,name,'product','p1',day,day); db.close();
  const auth = { Authorization: 'Bearer admin-token' };
  let response = await fetch(`${base}/api/admin/analytics/sales?start=2026-11-10&end=2026-11-10`, {headers:auth}); assert.equal(response.status, 200); let sales:any=await response.json(); assert.equal(sales.kpis.totalOrders,2); assert.equal(sales.kpis.nonCancelledOrders,1); assert.equal(sales.kpis.simulatedAmount,9000); assert.equal(sales.kpis.simulatedAverageTicket,9000); assert.equal(sales.topProducts[0].name,'Producto público'); assert(!JSON.stringify(sales).includes('private@test.local'));
  response=await fetch(`${base}/api/admin/analytics/behavior?period=7`,{headers:auth}); assert.equal(response.status,200); const behavior:any=await response.json(); assert.equal(behavior.kpis.productViews,1); assert(!JSON.stringify(behavior).includes('sess-1'));
  response=await fetch(`${base}/api/admin/analytics/game?period=7`,{headers:auth}); assert.equal(response.status,200); const game:any=await response.json(); assert.equal(game.kpis.victories,1); assert.equal(game.kpis.btlCouponsUsed,1);
  response=await fetch(`${base}/api/admin/analytics/conversion?period=7`,{headers:auth}); assert.equal(response.status,200); const conversion:any=await response.json(); assert.equal(conversion.coupons.ordersWithCoupon,1); assert.equal(conversion.sequentialRate.available,false);
  response=await fetch(`${base}/api/admin/analytics/customers?period=999`,{headers:auth}); assert.equal(response.status,400);
  response=await fetch(`${base}/api/admin/analytics/sales?period=7`); assert.equal(response.status,401);
  response=await fetch(`${base}/api/admin/analytics/sales?period=7`,{headers:{Authorization:'Bearer customer-token'}}); assert.equal(response.status,403);
  db.close?.(); console.log('Fase 3.2 isolated integration checks passed.');
} finally { if (server.exitCode === null) { const exited = new Promise<void>(resolve => server.once('exit', () => resolve())); server.kill(); await exited; } fs.rmSync(tempDir,{recursive:true,force:true,maxRetries:5}); }
