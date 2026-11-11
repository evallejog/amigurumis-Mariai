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

const dataDir = path.resolve(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'amigurumis_mariai.db');

if (!fs.existsSync(dbPath)) {
  console.error(`[ERROR] No se encontró la base de datos en: ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath);

const command = process.argv[2];
const targetEmail = process.argv[3];

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

switch (command) {
  case 'list':
    listUsers();
    break;
  case 'promote':
    promoteUser(targetEmail);
    break;
  case 'demote':
    demoteUser(targetEmail);
    break;
  default:
    console.log(`
=== AMIGURUMIS MARIAI — GESTIÓN DE ROLES ADMINISTRATIVOS ===
Herramienta segura de mantenimiento de cuentas sin contraseñas predeterminadas.

Comandos disponibles:
  npx tsx scripts/manage-admin.ts list
  npx tsx scripts/manage-admin.ts promote <email>
  npx tsx scripts/manage-admin.ts demote <email>

Ejemplo:
  npx tsx scripts/manage-admin.ts promote maria@amigurumismariai.com
`);
    break;
}
