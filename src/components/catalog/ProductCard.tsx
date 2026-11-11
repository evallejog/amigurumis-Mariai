import React, { useState } from 'react';
import { Product } from '../../types';
import { useCart } from '../../context/CartContext';
import { ShoppingBag, Eye, Check, AlertCircle, Sparkles, Clock } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onOpenDetail: (product: Product) => void;
  onInquireWhatsApp?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onOpenDetail,
  onInquireWhatsApp,
}) => {
  const { addToCart } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart(product, 1);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
  };

  const isOutOfStock = product.availability === 'out_of_stock';
  const isMadeToOrder = product.availability === 'made_to_order';
  const isPendingConfirmation = product.availability === 'pending_confirmation';
  const isLowStock = product.availability === 'low_stock';

  // Availability label badge
  const renderAvailabilityBadge = () => {
    if (isOutOfStock) {
      return (
        <span className="px-2 py-0.5 rounded-lg bg-rose-500/90 text-white text-[10px] font-bold backdrop-blur-md">
          Agotado
        </span>
      );
    }
    if (isLowStock && product.stockUnits !== undefined) {
      return (
        <span className="px-2 py-0.5 rounded-lg bg-amber-600/90 text-white text-[10px] font-bold backdrop-blur-md">
          ¡Pocas unidades! ({product.stockUnits})
        </span>
      );
    }
    if (product.availability === 'in_stock' && product.stockUnits !== undefined) {
      return (
        <span className="px-2 py-0.5 rounded-lg bg-emerald-600/85 text-white text-[10px] font-bold backdrop-blur-md">
          Disponibles: {product.stockUnits} u.
        </span>
      );
    }
    if (isMadeToOrder) {
      return (
        <span className="px-2 py-0.5 rounded-lg bg-stone-900/80 text-white text-[10px] font-medium backdrop-blur-md">
          Bajo pedido
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-lg bg-stone-600/80 text-white text-[10px] font-medium backdrop-blur-md">
        Disponibilidad por confirmar
      </span>
    );
  };

  return (
    <article
      onClick={() => onOpenDetail(product)}
      className="group liquid-glass rounded-3xl p-3 sm:p-4 border border-white/70 shadow-sm hover:shadow-xl hover:border-amber-300/40 transition-all duration-300 flex flex-col cursor-pointer relative overflow-hidden"
    >
      {/* Product Image Frame */}
      <div className="relative aspect-4/3 rounded-2xl overflow-hidden bg-stone-100/80 mb-3.5 border border-stone-200/50">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-stone-100 text-stone-400">
            <ShoppingBag className="w-8 h-8 mb-2 opacity-50" />
            <span className="text-xs">{product.imagePlaceholderText || product.name}</span>
          </div>
        )}

        {/* Status indicators */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start">
          {product.featured && (
            <span className="px-2.5 py-1 rounded-lg liquid-glass text-[11px] font-bold text-amber-900 shadow-xs backdrop-blur-md">
              Colección Destacada
            </span>
          )}
          {renderAvailabilityBadge()}
        </div>

        {/* Quick View Hover Overlay Button */}
        <div className="absolute inset-0 bg-stone-900/20 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail(product);
            }}
            className="px-3.5 py-2 rounded-xl liquid-btn-secondary text-stone-900 text-xs font-bold flex items-center gap-1.5 shadow-md transform translate-y-2 group-hover:translate-y-0 transition-transform cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Ver Ficha Técnica</span>
          </button>
        </div>
      </div>

      {/* Unboxed Metadata (Zero-Pill discipline) */}
      <div className="flex items-center gap-2 text-[11px] text-stone-500 uppercase tracking-wider mb-1.5 font-bold">
        <span>{product.category}</span>
        <span aria-hidden="true">·</span>
        <span>{product.approxCraftTimeHours || 6}h confección</span>
        {product.difficulty && (
          <>
            <span aria-hidden="true">·</span>
            <span>{product.difficulty}</span>
          </>
        )}
      </div>

      {/* Title */}
      <h3 className="text-base font-bold font-sans text-stone-900 group-hover:text-amber-900 transition-colors line-clamp-1 mb-1">
        {product.name}
      </h3>

      {/* Short Description */}
      <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed mb-4 flex-1 font-normal">
        {product.shortDescription}
      </p>

      {/* Footer: Price & Add to Cart Action */}
      <div className="pt-3 border-t border-stone-200/50 flex items-center justify-between mt-auto">
        <div>
          <span className="text-[10px] text-stone-400 block font-semibold">Precio Artesanal (COP)</span>
          <span className="text-base sm:text-lg font-bold text-stone-900 tabular-nums">
            $ {product.price.toLocaleString('es-CO')}
          </span>
        </div>

        <button
          onClick={handleQuickAdd}
          disabled={isOutOfStock}
          className={`py-2 px-3 sm:px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
            justAdded
              ? 'bg-emerald-600 text-white shadow-md'
              : isOutOfStock
              ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
              : 'liquid-btn-primary text-white'
          }`}
          aria-label={`Agregar ${product.name} a la bolsa`}
        >
          {justAdded ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>¡Agregado!</span>
            </>
          ) : isOutOfStock ? (
            <span>Agotado</span>
          ) : (
            <>
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Agregar</span>
            </>
          )}
        </button>
      </div>
    </article>
  );
};
