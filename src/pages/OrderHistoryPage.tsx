import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from '../components/common/BrandLogo';
import {
  ShoppingBag,
  FileText,
  Download,
  Calendar,
  MapPin,
  Clock,
  ArrowLeft,
  LogIn,
  CheckCircle2,
  Package,
  AlertCircle,
  Truck,
  Sparkles,
  ExternalLink
} from 'lucide-react';

interface OrderItem {
  id: string;
  productId?: string;
  productName?: string;
  unitPrice?: number;
  price?: number;
  quantity: number;
  subtotal?: number;
  imageUrl?: string;
  product?: {
    id?: string;
    name?: string;
    price?: number;
    imageUrl?: string;
  };
}

interface OrderRecord {
  id: string;
  orderNumber: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: string;
  shippingCity?: string;
  shippingDepartment?: string;
  customer?: {
    fullName?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    apartment?: string;
  };
  subtotal: number;
  discount: number;
  couponCode?: string;
  shippingCost: number;
  total: number;
  paymentMethod: string;
  status: string;
  notes?: string;
  accessToken?: string;
  isSimulated?: boolean;
  createdAt: string;
  items: OrderItem[];
}

export const OrderHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, token, isAuthenticated, openAuthModal } = useAuth();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/orders/my-orders', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error('No fue posible cargar tu historial de compras');
        }

        const data = await res.json();
        setOrders(data.orders || []);
      } catch (err: any) {
        setError(err.message || 'Error al conectar con el servidor');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [token]);

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat('es-CO', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
    } catch {
      return isoString;
    }
  };

  const getStatusBadge = (status: string) => {
    const st = status.toLowerCase();
    if (st.includes('confirmado') || st.includes('preparación') || st.includes('pagado')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
          <Clock className="w-3.5 h-3.5" />
          <span>En Preparación Artesanal</span>
        </span>
      );
    }
    if (st.includes('enviado')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300">
          <Truck className="w-3.5 h-3.5" />
          <span>Enviado por Coordinadora / Servientrega</span>
        </span>
      );
    }
    if (st.includes('entregado')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Entregado a Satisfacción</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-800 border border-stone-300">
        <Package className="w-3.5 h-3.5" />
        <span>{status}</span>
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#2E2823] flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-30 w-full bg-white/90 backdrop-blur-xl border-b border-stone-200 shadow-xs px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold transition-all cursor-pointer border border-stone-300/70"
          >
            <ArrowLeft className="w-4 h-4 text-stone-700" />
            <span>Volver a la Tienda</span>
          </button>
          <div className="h-5 w-px bg-stone-200" />
          <BrandLogo size="sm" />
        </div>

        <div>
          {isAuthenticated ? (
            <div className="flex items-center gap-2 text-xs font-bold text-stone-800">
              <span className="hidden sm:inline text-stone-500 font-normal">Conectado como:</span>
              <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-200">
                {user?.fullName || user?.email}
              </span>
            </div>
          ) : (
            <button
              onClick={() => openAuthModal('login')}
              className="px-3.5 py-1.5 rounded-xl liquid-btn-primary text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Iniciar Sesión</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
          <div>
            <h1 className="text-2xl sm:text-3xl font-sans font-extrabold text-stone-900">
              Mis Compras & Pedidos
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 mt-1">
              Consulta el estado de confección de tus amigurumis y descarga tus comprobantes en PDF.
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-900 flex items-center gap-2 max-w-xs">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Documento informativo interno de orden artesanal (no constituye factura electrónica DIAN).
            </span>
          </div>
        </div>

        {/* NOT AUTHENTICATED STATE */}
        {!isAuthenticated && (
          <div className="liquid-glass-elevated rounded-3xl p-8 sm:p-12 text-center space-y-4 max-w-md mx-auto my-12 border border-white/80 shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-sans font-bold text-stone-900">
              Inicia sesión para ver tus compras
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Ingresa con tu cuenta registrada para acceder al historial completo de pedidos, comprobantes en PDF
              y seguimiento artesanal.
            </p>
            <button
              onClick={() => openAuthModal('login')}
              className="w-full py-3 px-4 rounded-xl liquid-btn-primary text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <LogIn className="w-4 h-4" />
              <span>Iniciar Sesión o Registrarse</span>
            </button>
          </div>
        )}

        {/* LOADING STATE */}
        {isAuthenticated && loading && (
          <div className="p-12 text-center text-stone-500 text-sm">
            Cargando historial de pedidos artesanales...
          </div>
        )}

        {/* ERROR STATE */}
        {isAuthenticated && !loading && error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* EMPTY STATE */}
        {isAuthenticated && !loading && orders.length === 0 && (
          <div className="liquid-glass rounded-3xl p-8 sm:p-12 text-center space-y-4 border border-white/80 shadow-sm max-w-md mx-auto my-8">
            <div className="w-14 h-14 rounded-2xl bg-stone-100 text-stone-500 flex items-center justify-center mx-auto">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-sans font-bold text-stone-900">
              Aún no tienes compras registradas
            </h3>
            <p className="text-xs text-stone-600">
              Explora nuestra colección de figuras tejidas a crochet y realiza tu primer pedido hecho a mano.
            </p>
            <button
              onClick={() => navigate('/')}
              className="py-2.5 px-5 rounded-xl liquid-btn-primary text-white text-xs font-bold cursor-pointer"
            >
              Explorar Catálogo
            </button>
          </div>
        )}

        {/* ORDERS LIST */}
        {isAuthenticated && !loading && orders.length > 0 && (
          <div className="space-y-6">
            {orders.map((order) => (
              <div
                key={order.id}
                className="liquid-glass-elevated rounded-3xl p-6 sm:p-7 border border-white/90 shadow-md space-y-5 transition-all"
              >
                {/* Header of Order Card */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200/60">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono text-sm font-extrabold text-stone-900 bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-200">
                        {order.orderNumber}
                      </span>
                      {getStatusBadge(order.status)}
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-300">
                        <Sparkles className="w-3 h-3 text-amber-700" />
                        <span>Pedido Simulado (Demo)</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-stone-500 pt-1">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-stone-400" />
                        <span>{formatDate(order.createdAt)}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-stone-400" />
                        <span>{order.shippingCity || order.customer?.city || 'Colombia'}{(order.shippingDepartment && order.shippingDepartment !== (order.shippingCity || order.customer?.city)) ? `, ${order.shippingDepartment}` : ''}</span>
                      </span>
                    </div>
                  </div>

                  {/* Download PDF Button with Token Authorization */}
                  <a
                    href={`/api/orders/${order.id}/pdf${order.accessToken ? `?token=${order.accessToken}` : ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold shadow-xs transition-colors shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar Comprobante PDF (Demo)</span>
                  </a>
                </div>

                {/* Items in this order */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold font-sans text-stone-700 uppercase tracking-wider">
                    Detalle de Figuras Tejidas
                  </h4>
                  <div className="divide-y divide-stone-100 rounded-2xl bg-white/70 border border-stone-200/60 overflow-hidden">
                    {order.items.map((item) => {
                      const itemName = item.productName || item.product?.name || 'Figura tejida a crochet';
                      const itemUnitPrice = item.unitPrice ?? item.price ?? item.product?.price ?? 0;
                      const itemSubtotal = item.subtotal ?? itemUnitPrice * item.quantity;
                      return (
                        <div
                          key={item.id}
                          className="p-3.5 sm:p-4 flex items-center justify-between gap-4 text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 flex items-center justify-center font-bold text-xs">
                              {item.quantity}x
                            </div>
                            <div>
                              <p className="font-bold text-stone-900">{itemName}</p>
                              <p className="text-[11px] text-stone-500">
                                Precio unitario: {formatCOP(itemUnitPrice)}
                              </p>
                            </div>
                          </div>
                          <span className="font-bold text-stone-900 tabular-nums">
                            {formatCOP(itemSubtotal)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Order Summary Footer */}
                <div className="pt-3 border-t border-stone-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                  <div className="text-stone-500 space-y-0.5">
                    <p>
                      <strong>Envío a:</strong> {order.shippingAddress || order.customer?.address || 'Dirección no especificada'} ({order.shippingCity || order.customer?.city || 'Colombia'})
                    </p>
                    <p>
                      <strong>Método de pago:</strong> {order.paymentMethod}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-right justify-between sm:justify-end">
                    <div>
                      {order.discount > 0 && (
                        <p className="text-[11px] text-emerald-700 font-semibold">
                          Descuento {order.couponCode ? `(${order.couponCode})` : 'BTL'}: -{formatCOP(order.discount)}
                        </p>
                      )}
                      <p className="text-[11px] text-stone-500">
                        Envío: {order.shippingCost === 0 ? 'Gratis' : formatCOP(order.shippingCost)}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-400 block font-semibold">TOTAL PAGADO</span>
                      <span className="text-base font-extrabold text-stone-950 tabular-nums">
                        {formatCOP(order.total)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
