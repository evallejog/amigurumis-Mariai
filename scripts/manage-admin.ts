#!/usr/bin/env node
/**
 * Herramienta de mantenimiento y aprovisionamiento seguro de administradores
 * Plataforma: Amigurumis Mariai (Fase 2F.1)
 *
 * Uso manual en terminal:
 *   npx tsx scripts/manage-admin.ts list
 *   npx tsx scripts/manage-admin.ts promote <correo_usuario>
 *   npx tsx scripts/manage-admin.ts demote <correo_usuario>
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const dataDir = path.resolve(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'amigurumis_mariai.db');

if (!fs.existsSync(dbPath)) {
  console.error(`[ERROR] No se encontró la base de datos en: ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const command = process.argv[2];
const targetEmailOrPassword = process.argv[3];

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function listUsers() {
  console.log('\n=== LISTADO DE USUARIOS REGISTRADOS ===');
  const users = db.prepare(`
    SELECT id, name, email, role, provider, created_at
    FROM users
    ORDER BY created_at ASC
  `).all() as any[];

  if (users.length === 0) {
    console.log('No hay usuarios registrados en la base de datos.');
    return;
  }

  console.table(users.map(u => ({
    ID: u.id,
    Nombre: u.name,
    Email: u.email,
    Rol: u.role,
    Proveedor: u.provider,
    Fecha: u.created_at?.split('T')[0]
  })));
  console.log(`Total usuarios: ${users.length}\n`);
}

function promoteUser(email: string) {
  if (!email || !email.includes('@')) {
    console.error('[ERROR] Debes proporcionar un correo electrónico válido.');
    console.log('Uso: npx tsx scripts/manage-admin.ts promote <email>');
    process.exit(1);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = db.prepare('SELECT id, name, email, role FROM users WHERE email = ?').get(normalizedEmail) as any;

  if (!user) {
    console.error(`[ERROR] Usuario con correo "${normalizedEmail}" no encontrado en la base de datos.`);
    console.log('Consejo: El usuario debe registrarse previamente en la plataforma antes de ser promovido.');
    process.exit(1);
  }

  if (user.role === 'admin') {
    console.log(`[INFO] El usuario "${user.name}" (${user.email}) ya cuenta con el rol 'admin'.`);
    return;
  }

  const info = db.prepare(`
    UPDATE users
    SET role = 'admin'
    WHERE id = ?
  `).run(user.id);

  if (info.changes > 0) {
    console.log(`[ÉXITO] Usuario promovido exitosamente.`);
    console.log(`- ID: ${user.id}`);
    console.log(`- Nombre: ${user.name}`);
    console.log(`- Correo: ${user.email}`);
    console.log(`- Rol anterior: ${user.role}`);
    console.log(`- Nuevo rol: admin`);
    console.log(`El usuario ahora tiene acceso autorizado a /admin y a los endpoints /api/admin/*.\n`);
  } else {
    console.error('[ERROR] No se pudo actualizar el rol del usuario.');
  }
}

function demoteUser(email: string) {
  if (!email || !email.includes('@')) {
    console.error('[ERROR] Debes proporcionar un correo electrónico válido.');
    console.log('Uso: npx tsx scripts/manage-admin.ts demote <email>');
    process.exit(1);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = db.prepare('SELECT id, name, email, role FROM users WHERE email = ?').get(normalizedEmail) as any;

  if (!user) {
    console.error(`[ERROR] Usuario con correo "${normalizedEmail}" no encontrado.`);
    process.exit(1);
  }

  if (user.role === 'customer') {
    console.log(`[INFO] El usuario "${user.name}" (${user.email}) ya tiene rol 'customer'.`);
    return;
  }

  const info = db.prepare(`
    UPDATE users
    SET role = 'customer'
    WHERE id = ?
  `).run(user.id);

  if (info.changes > 0) {
    console.log(`[ÉXITO] Privilegios revocados para "${user.name}" (${user.email}). Rol actual: customer.\n`);
  }
}

// Fase 2F.1.2: Aprovisionamiento seguro de cuenta administrativa demo
function provisionAdminDemo(customPassword?: string) {
  const DEMO_EMAIL = 'admin.demo@amigurumismariai.test';
  const rawPassword = customPassword || process.env.ADMIN_DEMO_PASSWORD;

  // Requisito 7: Si no hay contraseña configurada ni mecanismo de entrega confidencial fuera de banda,
  // detener el aprovisionamiento antes de crear una cuenta inaccesible.
  if (!rawPassword || rawPassword.trim().length < 6) {
    console.warn(`
[AVISO DE SEGURIDAD - FASE 2F.1.2 / REQUISITO 7]
Google AI Studio no cuenta con un baúl de secretos (Secret Manager) con entrega ciega al cliente.
Para evitar crear una cuenta administrativa huérfana e inaccesible, el aprovisionamiento requiere
que la contraseña sea suministrada de forma privada mediante la variable de entorno ADMIN_DEMO_PASSWORD
(en el archivo no versionado .env) o como argumento del comando CLI:

  npx tsx scripts/manage-admin.ts provision-demo <contraseña_elegida>
  O bien configurando ADMIN_DEMO_PASSWORD=<tu_clave> en .env

No se creará una cuenta con contraseña desconocida ni predeterminada.
`);
    return;
  }

  const passwordHash = hashPassword(rawPassword.trim());
  const nowIso = new Date().toISOString();

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(DEMO_EMAIL) as any;

  if (existing) {
    db.prepare(`
      UPDATE users
      SET password_hash = ?, role = 'admin'
      WHERE email = ?
    `).run(passwordHash, DEMO_EMAIL);
    console.log(`[ÉXITO] Cuenta administrativa demo actualizada: ${DEMO_EMAIL} con rol 'admin'.`);
  } else {
    const userId = `usr-admin-demo-${Date.now().toString(36)}`;
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, provider, role, created_at)
      VALUES (?, 'Administrador Demo', ?, ?, 'local', 'admin', ?)
    `).run(userId, DEMO_EMAIL, passwordHash, nowIso);
    console.log(`[ÉXITO] Cuenta administrativa demo aprovisionada: ${DEMO_EMAIL} con rol 'admin'.`);
  }
  console.log('Credencial protegida con hash scrypt nativo. La contraseña no fue expuesta en logs ni versionada.');
}

// Fase 2F.1.2: Deshabilitación / Eliminación de cuenta demo para preparación a producción
function removeAdminDemo() {
  const DEMO_EMAIL = 'admin.demo@amigurumismariai.test';
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(DEMO_EMAIL) as any;

  if (!user) {
    console.log(`[INFO] La cuenta demo ${DEMO_EMAIL} no existe en la base de datos.`);
    return;
  }

  // Eliminar sesiones asociadas y el usuario demo exclusivamente
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  const info = db.prepare('DELETE FROM users WHERE id = ?').run(user.id);

  if (info.changes > 0) {
    console.log(`[ÉXITO] Cuenta administrativa demo ${DEMO_EMAIL} eliminada de forma segura para producción.`);
  }
}

switch (command) {
  case 'list':
    listUsers();
    break;
  case 'promote':
    promoteUser(targetEmailOrPassword);
    break;
  case 'demote':
    demoteUser(targetEmailOrPassword);
    break;
  case 'provision-demo':
  case 'create-demo':
    provisionAdminDemo(targetEmailOrPassword);
    break;
  case 'remove-demo':
    removeAdminDemo();
    break;
  default:
    console.log(`
=== AMIGURUMIS MARIAI — GESTIÓN DE ROLES ADMINISTRATIVOS ===
Herramienta segura de mantenimiento de cuentas sin contraseñas predeterminadas.

Comandos disponibles:
  npx tsx scripts/manage-admin.ts list
  npx tsx scripts/manage-admin.ts promote <email>
  npx tsx scripts/manage-admin.ts demote <email>
  npx tsx scripts/manage-admin.ts provision-demo [password]
  npx tsx scripts/manage-admin.ts remove-demo

Ejemplo:
  npx tsx scripts/manage-admin.ts promote maria@amigurumismariai.com
  npx tsx scripts/manage-admin.ts provision-demo
`);
    break;
}
