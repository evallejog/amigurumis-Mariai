import React, { useState, useEffect, useMemo } from 'react';
import { mockProducts } from '../../data/mockProducts';
import { Product } from '../../types';
import { ProductCard } from './ProductCard';
import { ProductDetailModal } from './ProductDetailModal';
import { Search, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { CustomSortSelect, SortOptionValue } from './CustomSortSelect';
import { track } from '../../analytics/client';

interface CatalogSectionProps {
  onInquireWhatsApp?: (product: Product) => void;
}

const CATEGORIES = [
  { id: 'todos', label: 'Todos los Diseños' },
  { id: 'animales', label: 'Animales del Bosque' },
  { id: 'marinos', label: 'Criaturas Marinas' },
  { id: 'fantasia', label: 'Fantasía y Magia' },
  { id: 'botanica', label: 'Botánica y Plantas' },
  { id: 'personalizados', label: 'Ediciones Especiales' },
];

export const CatalogSection: React.FC<CatalogSectionProps> = ({ onInquireWhatsApp }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'craft-time'>('featured');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const lastSearchEvent = React.useRef('');
  const lastCategoryEvent = React.useRef('todos');

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length >= 2 && query !== lastSearchEvent.current) {
      lastSearchEvent.current = query;
      track({ event_id: crypto.randomUUID(), event_type: 'product_searched', metadata: { query_length: Math.min(query.length, 100) } });
    }
  }, [searchQuery]);

  useEffect(() => {
    if (selectedCategory !== lastCategoryEvent.current) {
      lastCategoryEvent.current = selectedCategory;
      track({ event_id: crypto.randomUUID(), event_type: 'product_filtered', metadata: { category: selectedCategory } });
    }
  }, [selectedCategory]);

  const fetchCatalogProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/products');
      if (!res.ok) {
        throw new Error(`Error en el servidor: código ${res.status}`);
      }
      const data = await res.json();
      if (Array.isArray(data.products) && data.products.length > 0) {
        setProducts(data.products);
      } else {
        // Fallback a mockProducts si la base de datos no tiene filas
        setProducts(mockProducts);
      }
    } catch (err: any) {
      console.warn('[CATALOG] Error al cargar productos de SQLite, usando datos históricos de respaldo:', err);
      setError('No se pudo conectar en vivo con el catálogo; mostrando colección local.');
      setProducts(mockProducts);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalogProducts();

    // Permitir recarga suave si el administrador actualiza productos en otra pestaña
    const handleCatalogRefresh = () => fetchCatalogProducts();
    window.addEventListener('catalog_updated', handleCatalogRefresh);
    return () => window.removeEventListener('catalog_updated', handleCatalogRefresh);
  }, []);

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        const matchesCategory = selectedCategory === 'todos' || p.category === selectedCategory;
        const matchesQuery =
          searchQuery.trim() === '' ||
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.shortDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
          p.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesCategory && matchesQuery;
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return a.price - b.price;
        if (sortBy === 'price-desc') return b.price - a.price;
        if (sortBy === 'craft-time') return (a.approxCraftTimeHours || 0) - (b.approxCraftTimeHours || 0);
        return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
      });
  }, [products, selectedCategory, searchQuery, sortBy]);

  return (
    <section id="catalogo" className="pt-10 pb-20 sm:pt-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full liquid-glass text-xs font-semibold text-amber-900 mb-3 shadow-xs">
            <span>Colección Permanente</span>
            <span aria-hidden="true">·</span>
            <span>Piezas Únicas Hechas a Mano</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-sans font-extrabold text-stone-900 tracking-tight">
            Catálogo de Creaciones Artesanales
          </h2>
          <p className="mt-2 text-stone-600 text-sm sm:text-base max-w-2xl font-light">
            Explora piezas tejidas a mano y consulta en cada ficha los materiales, acabados y detalles disponibles.
          </p>
        </div>

        {/* Counter & Live Refresh */}
        <div className="flex items-center gap-3">
          <div className="text-xs text-stone-500 font-medium whitespace-nowrap">
            Mostrando <strong className="text-stone-900 font-bold tabular-nums">{filteredProducts.length}</strong> modelos disponibles
          </div>
          <button
            onClick={() => fetchCatalogProducts()}
            disabled={loading}
            title="Sincronizar catálogo con base de datos"
            className="p-1.5 rounded-xl bg-white/60 hover:bg-white text-stone-500 hover:text-stone-800 border border-stone-200/50 shadow-2xs transition-all cursor-pointer"
            aria-label="Actualizar catálogo"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-700' : ''}`} />
          </button>
        </div>
      </div>

      {/* Interactive Controls Bar: Category tabs + Search + Sort */}
      <div className="liquid-glass rounded-2xl p-3 sm:p-4 mb-8 border border-white/70 shadow-sm space-y-4">
        {/* Category Filter Pills (Functional Buttons) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-stone-900 text-white shadow-sm font-semibold'
                  : 'bg-white/50 text-stone-600 hover:text-stone-900 hover:bg-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search & Sort Row */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-stone-200/50">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, animal, temática (ej: osito, dragón, ballena)..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/70 border border-stone-200/80 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-600"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Liquid Glass Custom Sort Selector */}
          <CustomSortSelect value={sortBy} onChange={(val) => setSortBy(val)} />
        </div>
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="liquid-glass rounded-3xl p-12 text-center border border-white/70 max-w-lg mx-auto">
          <p className="text-stone-700 font-semibold mb-2">No se encontraron amigurumis con ese filtro</p>
          <p className="text-xs text-stone-500 mb-6 font-light">
            Prueba buscando con otros términos o restablece las categorías para ver toda la colección.
          </p>
          <button
            onClick={() => {
              setSelectedCategory('todos');
              setSearchQuery('');
            }}
            className="px-4 py-2 rounded-xl liquid-btn-primary text-white text-xs font-medium cursor-pointer"
          >
            Ver todos los modelos
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onOpenDetail={(prod) => { track({ event_id: crypto.randomUUID(), event_type: 'product_viewed', product_id: prod.id, metadata: { category: prod.category } }); setSelectedProduct(prod); }}
              onInquireWhatsApp={onInquireWhatsApp}
            />
          ))}
        </div>
      )}

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onInquireWhatsApp={onInquireWhatsApp}
      />
    </section>
  );
};
