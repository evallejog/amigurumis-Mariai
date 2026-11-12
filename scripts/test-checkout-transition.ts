import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checkout = fs.readFileSync(path.join(root, 'src', 'components', 'cart', 'CheckoutModal.tsx'), 'utf8');
const drawer = fs.readFileSync(path.join(root, 'src', 'components', 'cart', 'CartDrawer.tsx'), 'utf8');
const closedReturn = checkout.indexOf('if (!isCheckoutOpen) return null;');
const analyticsEffect = checkout.indexOf("if (isCheckoutOpen) track(");
assert.ok(analyticsEffect >= 0 && analyticsEffect < closedReturn, 'el efecto de checkout debe ejecutarse antes del retorno condicional');
assert.match(drawer, /setIsCartOpen\(false\);\s*setIsCheckoutOpen\(true\);/, 'el botón debe cerrar carrito y abrir checkout');
assert.match(checkout, /if \(!isCheckoutOpen\) return null;/, 'el checkout cerrado no debe renderizar el formulario');
assert.match(checkout, /step === 'details'/, 'el checkout abierto debe tener formulario de entrega');
assert.match(checkout, /handleCloseModal/, 'el checkout conserva cierre y regreso al carrito');
console.log('Regresión de transición carrito a checkout aprobada (orden de hooks y apertura del formulario).');
