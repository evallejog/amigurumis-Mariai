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
  ExternalLink,
  Tag,
  Copy,
  Check,
  Gamepad2,
  Gift
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
  isSimulated?: boolean;
  createdAt: string;
  items: OrderItem[];
}

interface UserCoupon {
  code: string;
  discountPercent: number;
  couponType?: string;
  targetType?: string;
  levelRequired?: number;
  maxUses: number;
  timesUsed: number;
  expiresAt?: string;
  isActive: number;
  description?: string;
  createdAt: string;
}

export const OrderHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, openAuthModal } = useAuth();
  const [activeTab, setActiveTab] = useState<'orders' | 'coupons'>('orders');
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [personalCoupons, setPersonalCoupons] = useState<UserCoupon[]>([]);
  const [generalCoupons, setGeneralCoupons] = useState<UserCoupon[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingCoupons, setLoadingCoupons] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/orders/my-orders', { credentials: 'same-origin' });

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
  }, [isAuthenticated]);

  const fetchCoupons = async () => {
    if (!isAuthenticated) return;
    try {
      setLoadingCoupons(true);
      const res = await fetch('/api/user/coupons', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        setPersonalCoupons(data.personalCoupons || []);
        setGeneralCoupons(data.generalCoupons || []);
      }
    } catch (err) {
      console.warn('Error fetching user coupons:', err);
    } finally {
      setLoadingCoupons(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'coupons' && isAuthenticated) {
      fetchCoupons();
    }
  }, [activeTab, isAuthenticated]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2500);
    });
  };

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
    if (st === 'pedido_recibido' || st.includes('recibido')) {
      return (
        <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-stone-200 text-stone-900 border border-stone-300 whitespace-nowrap shrink-0 shadow-2xs">
          <Package className="w-3.5 h-3.5" />
          <span>Pedido recibido</span>
        </span>
      );
    }
    if (st === 'en_preparacion' || st.includes('preparacion') || st.includes('preparación') || st.includes('confirmado') || st.includes('pagado')) {
      return (
        <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap shrink-0 shadow-2xs">
          <Clock className="w-3.5 h-3.5" />
          <span>En preparación</span>
        </span>
      );
    }
    if (st === 'enviado' || st.includes('enviado')) {
      return (
        <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300 whitespace-nowrap shrink-0 shadow-2xs">
          <Truck className="w-3.5 h-3.5" />
          <span>Enviado</span>
        </span>
      );
    }
    if (st === 'entregado' || st.includes('entregado')) {
      return (
        <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 whitespace-nowrap shrink-0 shadow-2xs">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Entregado</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-800 border border-stone-300 whitespace-nowrap shrink-0 shadow-2xs">
        <Package className="w-3.5 h-3.5" />
        <span>{status.replace('_', ' ')}</span>
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
              {activeTab === 'orders' ? 'Mis Compras & Pedidos' : 'Mis Cupones & Recompensas'}
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 mt-1">
              {activeTab === 'orders'
                ? 'Consulta el estado de confección de tus amigurumis y descarga tus comprobantes en PDF.'
                : 'Tus cupones personales desbloqueados en el minijuego de Pompón y promociones exclusivas.'}
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
              Inicia sesión para ver tus compras y cupones
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Ingresa con tu cuenta registrada para acceder a tu historial completo de pedidos, comprobantes en PDF
              y recompensas exclusivas ganadas en el videojuego de Pompón.
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

        {/* TAB SWITCHER */}
        {isAuthenticated && (
          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-stone-200/60 w-fit">
            <button
              onClick={() => setActiveTab('orders')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Mis Pedidos ({orders.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('coupons')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'coupons'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Gift className="w-3.5 h-3.5 text-amber-600" />
              <span>Mis Cupones & Recompensas ({personalCoupons.length})</span>
            </button>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* TAB 1: ORDERS */}
        {/* ----------------------------------------------------------------- */}
        {isAuthenticated && activeTab === 'orders' && (
          <>
            {/* LOADING STATE */}
            {loading && (
              <div className="p-12 text-center text-stone-500 text-sm">
                Cargando historial de pedidos artesanales...
              </div>
            )}

            {/* ERROR STATE */}
            {!loading && error && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* EMPTY STATE */}
            {!loading && orders.length === 0 && (
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
            {!loading && orders.length > 0 && (
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
                        href={`/api/orders/${order.id}/pdf`}
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
                              Descuento {order.couponCode ? `(${order.couponCode})` : 'Promoción'}: -{formatCOP(order.discount)}
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
          </>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* TAB 2: COUPONS & BTL REWARDS */}
        {/* ----------------------------------------------------------------- */}
        {isAuthenticated && activeTab === 'coupons' && (
          <div className="space-y-6">
            {/* Personal coupons section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                    <Gift className="w-4 h-4 text-amber-600" />
                    <span>Tus Cupones Exclusivos & Recompensas del Juego</span>
                  </h3>
                  <p className="text-xs text-stone-500">
                    Cupones vinculados exclusivamente a tu cuenta ({user?.email})
                  </p>
                </div>
                <button
                  onClick={() => navigate('/#juego')}
                  className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer"
                >
                  <Gamepad2 className="w-3.5 h-3.5" />
                  <span>Jugar para Desbloquear Más</span>
                </button>
              </div>

              {loadingCoupons ? (
                <div className="p-8 text-center text-xs text-stone-500">Cargando tus cupones...</div>
              ) : personalCoupons.length === 0 ? (
                <div className="liquid-glass rounded-3xl p-7 text-center space-y-3 border border-white/80 max-w-md mx-auto">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
                    <Gamepad2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-stone-900">Aún no tienes recompensas del juego activas</h4>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Supera los niveles en "Las Aventuras de Pompón" para desbloquear cupones únicos del 5%, 10% y 15% OFF asociados a tu cuenta.
                  </p>
                  <button
                    onClick={() => navigate('/jugar')}
                    className="py-2 px-4 rounded-xl liquid-btn-primary text-white text-xs font-bold cursor-pointer"
                  >
                    Ir al Videojuego Pompón
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {personalCoupons.map((coupon) => {
                    const isBtl = coupon.couponType === 'btl' || coupon.code.startsWith('MARIAI-');
                    const isUsed = coupon.timesUsed >= coupon.maxUses;
                    const isExpired = coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now();
                    const isAvailable = coupon.isActive && !isUsed && !isExpired;

                    return (
                      <div
                        key={coupon.code}
                        className={`rounded-3xl p-5 border transition-all ${
                          isAvailable
                            ? 'liquid-glass-elevated border-white/90 shadow-md bg-white/90'
                            : 'bg-stone-100/70 border-stone-200/80 opacity-75'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-200/60">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-amber-100 text-amber-950 font-black text-sm whitespace-nowrap shrink-0 border border-amber-300">
                              {coupon.discountPercent}% OFF
                            </span>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap shrink-0 ${
                                isBtl
                                  ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                  : 'bg-amber-100 text-amber-900 border border-amber-300'
                              }`}
                            >
                              {isBtl ? 'Recompensa del Juego' : 'Exclusivo Cliente'}
                            </span>
                          </div>

                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap shrink-0 ${
                              isAvailable
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : isUsed
                                ? 'bg-stone-200 text-stone-700'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {isAvailable ? 'Disponible' : isUsed ? 'Canjeado' : isExpired ? 'Expirado' : 'Inactivo'}
                          </span>
                        </div>

                        <div className="py-3 space-y-2">
                          <div className="flex items-center justify-between bg-stone-100/90 rounded-xl p-2 px-3 border border-stone-200">
                            <span className="font-mono font-black text-sm text-stone-900 tracking-wider">
                              {coupon.code}
                            </span>
                            <button
                              onClick={() => handleCopyCode(coupon.code)}
                              className="p-1.5 rounded-lg bg-white hover:bg-stone-200 text-stone-700 transition-colors flex items-center gap-1 text-[11px] font-bold cursor-pointer shadow-2xs"
                              title="Copiar código"
                            >
                              {copiedCode === coupon.code ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="text-emerald-700">¡Copiado!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5 text-stone-500" />
                                  <span>Copiar</span>
                                </>
                              )}
                            </button>
                          </div>

                          <p className="text-xs text-stone-600 leading-relaxed">
                            {coupon.description || `Descuento del ${coupon.discountPercent}% en cualquier amigurumi.`}
                          </p>

                          {coupon.expiresAt && (
                            <p className="text-[11px] text-stone-500 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-stone-400" />
                              <span>Válido hasta: {coupon.expiresAt.split('T')[0]}</span>
                            </p>
                          )}
                        </div>

                        {isAvailable && (
                          <div className="pt-2">
                            <button
                              onClick={() => {
                                handleCopyCode(coupon.code);
                                navigate('/#catalogo');
                              }}
                              className="w-full py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                            >
                              <ShoppingBag className="w-3.5 h-3.5" />
                              <span>Usar Cupón en la Tienda</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* General store coupons */}
            {generalCoupons.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-stone-200/70">
                <div>
                  <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-blue-600" />
                    <span>Promociones Comerciales Generales</span>
                  </h3>
                  <p className="text-xs text-stone-500">Disponibles para todos los clientes de Amigurumis Mariai</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {generalCoupons.map((c) => (
                    <div
                      key={c.code}
                      className="p-4 rounded-2xl liquid-glass border border-white/80 bg-white/80 space-y-2 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono font-bold text-xs text-stone-900">{c.code}</span>
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 font-extrabold text-[10px]">
                            {c.discountPercent}% OFF
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-600 line-clamp-2">{c.description}</p>
                      </div>

                      <button
                        onClick={() => handleCopyCode(c.code)}
                        className="w-full py-1.5 px-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-[11px] font-bold cursor-pointer transition-colors flex items-center justify-center gap-1"
                      >
                        {copiedCode === c.code ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copiar Código</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
