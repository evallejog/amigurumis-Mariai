#!/usr/bin/env node
/**
 * Herramienta de mantenimiento y aprovisionamiento seguro de cuentas administrativas
 * Plataforma: Amigurumis Mariai
 *
 * Cuenta Administrativa Principal Oficial:
 *   - Email: admin@amigurumismariai.com
 *   - Nombre: Administrador Mariai
 *   - Rol: admin
 *
 * Uso en terminal:
 *   npx tsx scripts/manage-admin.ts list
 *   npx tsx scripts/manage-admin.ts provision-admin [contraseña]
 *   npx tsx scripts/manage-admin.ts reset-admin-password <nueva_contraseña>
 *   npx tsx scripts/manage-admin.ts revoke-demo
 *   npx tsx scripts/manage-admin.ts promote <correo_usuario>
 *   npx tsx scripts/manage-admin.ts demote <correo_usuario>
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import readline from 'readline';

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
const arg1 = process.argv[3];

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function promptPassword(promptText: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
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

// Aprovisionamiento seguro e idempotente de la cuenta administrativa principal
async function provisionMainAdmin(customPassword?: string, forceUpdate: boolean = false) {
  const ADMIN_EMAIL = 'admin@amigurumismariai.com';
  const ADMIN_NAME = 'Administrador Mariai';

  const existing = db.prepare('SELECT id, name, email, role FROM users WHERE email = ?').get(ADMIN_EMAIL) as any;

  if (existing && !forceUpdate && !customPassword) {
    console.log(`[INFO] La cuenta administrativa principal "${ADMIN_EMAIL}" ya existe con rol "${existing.role}".`);
    console.log('Por política de seguridad idempotente, sus credenciales y estado se preservaron sin alteraciones.');
    console.log('Para actualizar su contraseña de forma explícita, ejecuta:');
    console.log('  npx tsx scripts/manage-admin.ts reset-admin-password <nueva_contraseña>\n');
    return;
  }

  let rawPassword = customPassword || process.env.ADMIN_PASSWORD;

  if (!rawPassword && process.stdin.isTTY) {
    console.log(`\n[APROVISIONAMIENTO INTERACTIVO] Cuenta: ${ADMIN_EMAIL}`);
    rawPassword = await promptPassword('Ingresa la contraseña para la cuenta administrativa (mínimo 6 caracteres): ');
  }

  if (!rawPassword || rawPassword.trim().length < 6) {
    console.warn(`
[AVISO DE SEGURIDAD]
Para aprovisionar la cuenta administrativa "${ADMIN_EMAIL}" sin exponer contraseñas en el código fuente,
debes suministrar la contraseña de una de las siguientes formas seguras:

1. Configurando ADMIN_PASSWORD en el archivo no versionado .env:
   ADMIN_PASSWORD=<tu_clave_privada>
   Y luego ejecutar:
   npx tsx scripts/manage-admin.ts provision-admin

2. Pasándola como argumento en la terminal:
   npx tsx scripts/manage-admin.ts provision-admin <tu_clave_privada>

3. De forma interactiva si se ejecuta en una terminal interactiva (TTY).

No se creará una cuenta con contraseña vacía o menor a 6 caracteres.
`);
    process.exit(1);
  }

  const cleanPassword = rawPassword.trim();
  const passwordHash = hashPassword(cleanPassword);
  const nowIso = new Date().toISOString();

  if (existing) {
    db.prepare(`
      UPDATE users
      SET name = ?, password_hash = ?, role = 'admin'
      WHERE email = ?
    `).run(ADMIN_NAME, passwordHash, ADMIN_EMAIL);
    console.log(`[ÉXITO] Contraseña y rol de la cuenta administrativa "${ADMIN_EMAIL}" actualizados exitosamente.`);
  } else {
    const userId = `usr-admin-${Date.now().toString(36)}`;
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, provider, role, created_at)
      VALUES (?, ?, ?, ?, 'local', 'admin', ?)
    `).run(userId, ADMIN_NAME, ADMIN_EMAIL, passwordHash, nowIso);
    console.log(`[ÉXITO] Cuenta administrativa principal aprovisionada exitosamente:`);
    console.log(`- ID: ${userId}`);
    console.log(`- Nombre: ${ADMIN_NAME}`);
    console.log(`- Correo: ${ADMIN_EMAIL}`);
    console.log(`- Rol: admin`);
  }

  console.log('Credencial protegida con hash scrypt nativo (64 bytes). La contraseña no fue expuesta en logs ni versionada.\n');
}

// Revocación y eliminación segura de la cuenta demo anterior
function revokeAdminDemo() {
  const DEMO_EMAIL = 'admin.demo@amigurumismariai.test';
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(DEMO_EMAIL) as any;

  if (!user) {
    console.log(`[INFO] La cuenta demo ${DEMO_EMAIL} no existe en la base de datos (ya se encontraba revocada).`);
    return;
  }

  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  const info = db.prepare('DELETE FROM users WHERE id = ?').run(user.id);

  if (info.changes > 0) {
    console.log(`[ÉXITO] Cuenta demo "${DEMO_EMAIL}" y sus sesiones han sido revocadas y eliminadas de forma segura de SQLite.\n`);
  }
}

function promoteUser(email: string) {
  if (!email || !email.includes('@')) {
    console.error('[ERROR] Debes proporcionar un correo electrónico válido.');
    console.log('Uso: npx tsx scripts/manage-admin.ts promote <email>');
    process.exit(1);
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Salvaguarda explícita: no utilizar el correo personal del propietario
  if (normalizedEmail === 'charlesvalle2006@gmail.com') {
    console.warn(`
[AVISO DE POLÍTICA DE SEGURIDAD]
Por directriz arquitectónica, el correo personal del propietario (${normalizedEmail})
NO debe utilizarse como cuenta administrativa.
Por favor utiliza la cuenta institucional oficial: "admin@amigurumismariai.com".
`);
    return;
  }

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
    console.log(`- Nuevo rol: admin\n`);
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

async function main() {
  switch (command) {
    case 'list':
      listUsers();
      break;

    case 'provision-admin':
    case 'provision':
      await provisionMainAdmin(arg1, false);
      break;

    case 'reset-admin-password':
    case 'update-admin-password':
      if (!arg1) {
        console.error('[ERROR] Debes indicar la nueva contraseña para admin@amigurumismariai.com');
        console.log('Uso: npx tsx scripts/manage-admin.ts reset-admin-password <nueva_clave>');
        process.exit(1);
      }
      await provisionMainAdmin(arg1, true);
      break;

    case 'revoke-demo':
    case 'remove-demo':
      revokeAdminDemo();
      break;

    case 'promote':
      promoteUser(arg1);
      break;

    case 'demote':
      demoteUser(arg1);
      break;

    default:
      console.log(`
=== AMIGURUMIS MARIAI — GESTIÓN DE ROLES ADMINISTRATIVOS ===
Herramienta segura de mantenimiento de cuentas sin contraseñas fijas en código.

Cuenta Administrativa Principal:
  - Correo: admin@amigurumismariai.com
  - Nombre: Administrador Mariai
  - Rol: admin

Comandos disponibles:
  npx tsx scripts/manage-admin.ts list
  npx tsx scripts/manage-admin.ts provision-admin [contraseña]
  npx tsx scripts/manage-admin.ts reset-admin-password <contraseña>
  npx tsx scripts/manage-admin.ts revoke-demo
  npx tsx scripts/manage-admin.ts promote <email>
  npx tsx scripts/manage-admin.ts demote <email>

Variables de entorno admitidas en .env:
  ADMIN_PASSWORD=<contraseña_privada>
`);
      break;
  }
}

main().catch((err) => {
  console.error('Error fatal en manage-admin:', err);
  process.exit(1);
});
