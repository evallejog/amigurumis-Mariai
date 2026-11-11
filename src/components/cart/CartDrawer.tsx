import React from 'react';
import { useCart } from '../../context/CartContext';
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight, Truck, ShieldCheck, Info } from 'lucide-react';

export const CartDrawer: React.FC = () => {
  const {
    items,
    isCartOpen,
    setIsCartOpen,
    removeFromCart,
    updateQuantity,
    subtotal,
    isShippingCalculated,
    shippingCost,
    total,
    setIsCheckoutOpen,
    pendingCouponCode,
  } = useCart();

  if (!isCartOpen) return null;

  const handleProceedToCheckout = () => {
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Translucent backdrop */}
      <div
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-md transition-opacity duration-300"
        onClick={() => setIsCartOpen(false)}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md liquid-glass-elevated border-l border-white/60 flex flex-col shadow-2xl transition-transform duration-300 transform translate-x-0">
          {/* Header */}
          <div className="px-6 py-5 border-b border-stone-200/50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-100/70 border border-amber-200/50 flex items-center justify-center text-amber-900">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-sans font-bold text-stone-900">Bolsa de Compras</h2>
                <p className="text-xs text-stone-500 font-normal">
                  {items.length === 0 ? 'Sin artículos seleccionados' : `${items.length} ${items.length === 1 ? 'amigurumi artesanal' : 'amigurumis artesanales'}`}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsCartOpen(false)}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-800 hover:bg-white/80 transition-colors cursor-pointer"
              aria-label="Cerrar carrito"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Colombian Artisan Shipping Notice (Honest & Informative) */}
          {items.length > 0 && (
            <div className="px-6 py-3 bg-amber-50/70 border-b border-amber-100/70 flex items-center gap-2.5 text-xs text-amber-900">
              <Truck className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Envíos nacionales a toda Colombia · Las tarifas exactas se calculan en el checkout según tu ciudad.</span>
            </div>
          )}

          {/* Cart Item List */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-500">
                <div className="w-16 h-16 rounded-2xl liquid-glass flex items-center justify-center mb-4 text-stone-400">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h3 className="text-base font-sans font-bold text-stone-800 mb-1">Tu bolsa está vacía</h3>
                <p className="text-sm text-stone-500 max-w-xs mb-6 font-normal">
                  Descubre piezas únicas en nuestro catálogo o supera los niveles de nuestro videojuego Pompón para obtener beneficios especiales.
                </p>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="px-5 py-2.5 rounded-xl liquid-btn-primary text-white text-sm font-bold cursor-pointer"
                >
                  Explorar Colección
                </button>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="liquid-glass rounded-2xl p-3.5 border border-white/70 shadow-sm flex gap-3.5 relative group hover:border-amber-300/40 transition-colors"
                >
                  {/* Image */}
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-stone-100 flex-shrink-0 border border-stone-200/60 relative">
                    {item.product.imageUrl ? (
                      <img
                        src={item.product.imageUrl}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-stone-100 text-stone-400">
                        <ShoppingBag className="w-6 h-6" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-sans font-bold text-stone-900 truncate">
                          {item.product.name}
                        </h4>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-stone-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                          aria-label={`Eliminar ${item.product.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <p className="text-xs text-stone-500 capitalize font-medium">
                        {item.product.category}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      {/* Quantity Controls */}
                      <div className="flex items-center bg-white/80 border border-stone-200/80 rounded-lg p-0.5">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-6 h-6 rounded flex items-center justify-center text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
                          aria-label="Disminuir cantidad"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-7 text-center text-xs font-bold tabular-nums text-stone-800">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          disabled={typeof item.product.stockUnits === 'number' && item.quantity >= item.product.stockUnits}
                          className="w-6 h-6 rounded flex items-center justify-center text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label="Aumentar cantidad"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Price in COP */}
                      <div className="text-right">
                        <span className="text-sm font-bold text-stone-900 tabular-nums">
                          $ {(item.product.price * item.quantity).toLocaleString('es-CO')}
                        </span>
                        {item.quantity > 1 && (
                          <div className="text-[11px] text-stone-400 tabular-nums font-normal">
                            ($ {item.product.price.toLocaleString('es-CO')} c/u)
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Summary & Checkout CTA */}
          {items.length > 0 && (
            <div className="p-6 border-t border-stone-200/60 liquid-glass space-y-3.5">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-stone-600">
                  <span>Subtotal productos</span>
                  <span className="font-bold text-stone-900 tabular-nums">
                    $ {subtotal.toLocaleString('es-CO')} COP
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs text-stone-500 py-1 border-y border-stone-200/40">
                  <span className="flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    Cálculo de envío:
                  </span>
                  <span className="font-semibold text-amber-900 text-right">
                    {isShippingCalculated && shippingCost !== null
                      ? `$ ${shippingCost.toLocaleString('es-CO')} COP`
                      : 'Pendiente de calcular'}
                  </span>
                </div>

                <div className="text-[11px] text-stone-500 italic">
                  * Se calculará al ingresar tu dirección y seleccionar el tipo de envío en el siguiente paso.
                </div>

                {pendingCouponCode && (
                  <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-200/80 flex items-center justify-between text-xs text-amber-900 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Cupón de recompensa listo:</span>
                    </span>
                    <span className="font-mono font-bold">{pendingCouponCode}</span>
                  </div>
                )}

                <div className="pt-2 flex justify-between text-base font-bold text-stone-900">
                  <span>{isShippingCalculated ? 'Total con envío' : 'Total (sin envío)'}</span>
                  <span className="text-lg tabular-nums">
                    $ {total.toLocaleString('es-CO')} COP
                  </span>
                </div>
              </div>

              <button
                onClick={handleProceedToCheckout}
                className="w-full py-3.5 px-4 rounded-xl liquid-btn-primary text-white font-bold text-sm flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span>Continuar a Entrega & Pago</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-stone-500 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Atención artesanal y despachos nacionales asegurados</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
