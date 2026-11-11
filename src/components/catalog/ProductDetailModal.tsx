import React, { useState } from 'react';
import { Product } from '../../types';
import { useCart } from '../../context/CartContext';
import { X, ShoppingBag, Check, ShieldCheck, Clock, Ruler, MessageCircle, AlertCircle } from 'lucide-react';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onInquireWhatsApp?: (product: Product) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onInquireWhatsApp,
}) => {
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  if (!product) return null;

  const handleAddToCart = () => {
    addToCart(product, quantity);
    setJustAdded(true);
    setTimeout(() => {
      setJustAdded(false);
      onClose();
    }, 1200);
  };

  const isOutOfStock = product.availability === 'out_of_stock';
  const isMadeToOrder = product.availability === 'made_to_order';
  const isPendingConfirmation = product.availability === 'pending_confirmation';
  const isLowStock = product.availability === 'low_stock';

  const getAvailabilityText = () => {
    if (isOutOfStock) return 'Agotado Temporalmente';
    if (isLowStock && product.stockUnits !== undefined) return `Pocas unidades disponibles (${product.stockUnits} u. en taller)`;
    if (product.availability === 'in_stock' && product.stockUnits !== undefined) return `Disponible en Taller (${product.stockUnits} unidades)`;
    if (isMadeToOrder) return 'Confección Artesanal Bajo Pedido (4 a 7 días)';
    return 'Disponibilidad por confirmar';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6 md:p-10">
      {/* Translucent backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/40 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-3xl liquid-glass-elevated rounded-3xl border border-white/80 shadow-2xl overflow-hidden z-10">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-xl text-stone-400 hover:text-stone-800 bg-white/60 hover:bg-white backdrop-blur-md transition-colors cursor-pointer"
          aria-label="Cerrar modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Left: Product Image */}
          <div className="relative aspect-square md:aspect-auto bg-stone-100 flex items-center justify-center p-6 border-b md:border-b-0 md:border-r border-stone-200/60">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-cover rounded-2xl shadow-sm"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="text-center text-stone-400">
                <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <span className="text-xs">{product.name}</span>
              </div>
            )}
            <div className="absolute top-4 left-4">
              <span className="px-3 py-1 rounded-lg liquid-glass text-xs font-bold text-stone-800 backdrop-blur-md">
                100% Hecho a Mano
              </span>
            </div>
          </div>

          {/* Right: Contiguous Purchase Module */}
          <div className="p-6 sm:p-8 flex flex-col justify-between space-y-6">
            <div>
              {/* Category & Status */}
              <div className="flex items-center gap-2 text-xs text-stone-500 font-bold uppercase tracking-wider mb-2">
                <span>{product.category}</span>
                <span aria-hidden="true">·</span>
                <span className={isOutOfStock ? 'text-rose-600' : isLowStock ? 'text-amber-700' : 'text-emerald-700'}>
                  {getAvailabilityText()}
                </span>
              </div>

              {/* Title with modern sans-serif */}
              <h2 className="text-2xl font-sans font-bold text-stone-900 mb-2">
                {product.name}
              </h2>

              {/* Price in COP */}
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-2xl font-sans font-bold text-stone-900 tabular-nums">
                  $ {product.price.toLocaleString('es-CO')}
                </span>
                <span className="text-xs font-bold text-stone-400 uppercase">COP</span>
              </div>

              {/* Description */}
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed mb-6 font-normal">
                {product.fullDescription || product.shortDescription}
              </p>

              {/* Technical Specifications */}
              <div className="space-y-3 pt-4 border-t border-stone-200/50 text-xs">
                {product.dimensions && (
                  <div className="flex items-center gap-2 text-stone-700">
                    <Ruler className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>
                      Medidas: <strong>{product.dimensions.heightCm} cm</strong> de alto ×{' '}
                      <strong>{product.dimensions.widthCm} cm</strong> de ancho
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-stone-700">
                  <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    Tiempo de tejido: <strong>{product.approxCraftTimeHours || 8} horas</strong> de labor punto a punto
                  </span>
                </div>

                {product.materials && (
                  <div className="pt-2">
                    <span className="block text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">
                      Materiales e Insumos:
                    </span>
                    <ul className="grid grid-cols-1 gap-1 text-stone-600">
                      {product.materials.map((mat, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <span>{mat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Quantity and Actions */}
            <div className="pt-6 border-t border-stone-200/60 space-y-3">
              <div className="flex items-center gap-3">
                {/* Quantity stepper */}
                <div className="flex items-center bg-white/80 border border-stone-200 rounded-xl p-1">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-600 hover:bg-stone-100 font-bold transition-colors cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-10 text-center font-bold text-stone-900 tabular-nums text-sm">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity((q) => {
                      const maxStock = typeof product.stockUnits === 'number' ? product.stockUnits : 999;
                      return Math.min(maxStock, q + 1);
                    })}
                    disabled={typeof product.stockUnits === 'number' && quantity >= product.stockUnits}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-600 hover:bg-stone-100 font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>

                {/* Primary Buy Button */}
                <button
                  onClick={handleAddToCart}
                  disabled={isOutOfStock}
                  className={`flex-1 py-3 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    justAdded
                      ? 'bg-emerald-600 text-white shadow-md'
                      : isOutOfStock
                      ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                      : 'liquid-btn-primary text-white'
                  }`}
                >
                  {justAdded ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>¡Agregado a la Bolsa!</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4" />
                      <span>Agregar a la Bolsa</span>
                    </>
                  )}
                </button>
              </div>

              {/* WhatsApp Alternative */}
              {onInquireWhatsApp && (
                <button
                  onClick={() => onInquireWhatsApp(product)}
                  className="w-full py-2.5 px-4 rounded-xl liquid-btn-secondary text-stone-700 hover:text-stone-900 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>Consultar detalles por WhatsApp</span>
                </button>
              )}

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-stone-400 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Garantía artesanal y confección en hilos hipoalergénicos</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
