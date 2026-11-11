import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from '../components/common/BrandLogo';
import {
  LayoutDashboard,
  ShoppingBag,
  Users,
  Tag,
  Gamepad2,
  BarChart3,
  Cpu,
  ArrowLeft,
  LogOut,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Package,
  Truck,
  FileText,
  AlertCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Layers,
  Database,
  Lock,
  ArrowUpRight,
  TrendingUp,
  Award,
  Filter
} from 'lucide-react';

type AdminTab = 'overview' | 'orders' | 'customers' | 'coupons' | 'btl' | 'analytics' | 'ml';

interface OverviewData {
  totalOrders: number;
  totalRevenue: number;
  totalSubtotal: number;
  totalDiscounts: number;
  averageOrderValue: number;
  totalCustomers: number;
  totalCoupons: number;
  totalCouponsRedeemed: number;
  btlGamesPlayed: number;
  btlVictories: number;
  btlWoolCollected: number;
}

interface OrderRecord {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  customer_city?: string;
  customer_address?: string;
  shipping_method: string;
  payment_method: string;
  subtotal: number;
  shipping_cost: number;
  discount: number;
  coupon_code?: string;
  total: number;
  status: string;
  is_simulated: number;
  created_at: string;
  item_count: number;
}

interface CustomerRecord {
  id: string;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  department?: string;
  created_at: string;
  orders_count: number;
  total_spent: number;
  last_order_date?: string;
}

interface CouponRecord {
  code: string;
  discount_percent: number;
  level_required?: number;
  max_uses: number;
  times_used: number;
  is_active: number;
  description?: string;
  created_at: string;
  expires_at?: string;
}

interface BtlLevelStat {
  level: number;
  attempts: number;
  victories: number;
  wool_collected: number;
  avg_score: number;
  avg_time: number;
}

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, token, isAuthenticated, isLoading: authLoading, logout, openAuthModal } = useAuth();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Data states
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  // Orders table state
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [orderPage, setOrderPage] = useState<number>(1);
  const [orderTotalPages, setOrderTotalPages] = useState<number>(1);
  const [orderTotalCount, setOrderTotalCount] = useState<number>(0);
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('todos');
  const [orderSearch, setOrderSearch] = useState<string>('');

  // Customers table state
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [customerPage, setCustomerPage] = useState<number>(1);
  const [customerTotalPages, setCustomerTotalPages] = useState<number>(1);
  const [customerTotalCount, setCustomerTotalCount] = useState<number>(0);

  // Coupons table state
  const [coupons, setCoupons] = useState<CouponRecord[]>([]);

  // BTL Telemetry state
  const [btlSummary, setBtlSummary] = useState<any>(null);
  const [btlLevelStats, setBtlLevelStats] = useState<BtlLevelStat[]>([]);

  // Fetch functions with Bearer token authentication
  const getAuthHeaders = (): Record<string, string> => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const loadOverview = async () => {
    try {
      setLoadingData(true);
      setErrorMessage(null);
      const res = await fetch('/api/admin/overview', { headers: getAuthHeaders() });
      if (!res.ok) {
        if (res.status === 403) throw new Error('No tienes permisos de administrador.');
        throw new Error('Error al obtener datos de resumen.');
      }
      const data = await res.json();
      setOverview(data.overview);
      setRecentOrders(data.recentOrders || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de conexión con el servidor.');
    } finally {
      setLoadingData(false);
    }
  };

  const loadOrders = async (page = orderPage, status = orderStatusFilter) => {
    try {
      setLoadingData(true);
      const query = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(status !== 'todos' ? { status } : {}),
      });
      const res = await fetch(`/api/admin/orders?${query.toString()}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Error al consultar pedidos.');
      const data = await res.json();
      setOrders(data.orders || []);
      setOrderPage(data.pagination.page);
      setOrderTotalPages(data.pagination.totalPages);
      setOrderTotalCount(data.pagination.total);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoadingData(false);
    }
  };

  const loadCustomers = async (page = customerPage) => {
    try {
      setLoadingData(true);
      const res = await fetch(`/api/admin/customers?page=${page}&limit=10`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Error al consultar clientes.');
      const data = await res.json();
      setCustomers(data.customers || []);
      setCustomerPage(data.pagination.page);
      setCustomerTotalPages(data.pagination.totalPages);
      setCustomerTotalCount(data.pagination.total);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoadingData(false);
    }
  };

  const loadCoupons = async () => {
    try {
      setLoadingData(true);
      const res = await fetch('/api/admin/coupons', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Error al consultar cupones.');
      const data = await res.json();
      setCoupons(data.coupons || []);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoadingData(false);
    }
  };

  const loadBtl = async () => {
    try {
      setLoadingData(true);
      const res = await fetch('/api/admin/btl/overview', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Error al consultar telemetría BTL.');
      const data = await res.json();
      setBtlSummary(data.summary);
      setBtlLevelStats(data.levelStats || []);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoadingData(false);
    }
  };

  // Initial load when tab changes or admin confirms auth
  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') return;

    if (activeTab === 'overview') loadOverview();
    else if (activeTab === 'orders') loadOrders(1, orderStatusFilter);
    else if (activeTab === 'customers') loadCustomers(1);
    else if (activeTab === 'coupons') loadCoupons();
    else if (activeTab === 'btl') loadBtl();
  }, [activeTab, isAuthenticated, user]);

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
        <div className="p-8 rounded-3xl liquid-glass-elevated border border-white/80 shadow-xl flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-10 h-10 border-3 border-amber-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-stone-800">Verificando credenciales de acceso...</p>
        </div>
      </div>
    );
  }

  // Unauthenticated state
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
        <div className="w-full max-w-md p-8 rounded-3xl liquid-glass-elevated border border-white/80 shadow-2xl bg-white/80 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-100/80 text-amber-900 flex items-center justify-center mx-auto mb-4 shadow-xs">
            <Lock className="w-7 h-7 text-amber-700" />
          </div>
          <h2 className="text-xl font-bold text-stone-900 mb-2">Panel Administrativo Protegido</h2>
          <p className="text-xs text-stone-600 leading-relaxed mb-6">
            Esta sección está restringida a usuarios con privilegios de administración de Amigurumis Mariai. Inicia sesión con tus credenciales autorizadas.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => openAuthModal('login')}
              className="w-full py-3 px-4 rounded-xl liquid-btn-primary text-white text-xs font-bold cursor-pointer shadow-md"
            >
              Iniciar Sesión
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full py-2.5 px-4 rounded-xl text-stone-600 hover:text-stone-900 hover:bg-stone-200/50 text-xs font-semibold cursor-pointer transition-colors"
            >
              Volver a la Tienda
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated but NOT admin state (403 Forbidden)
  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
        <div className="w-full max-w-md p-8 rounded-3xl liquid-glass-elevated border border-rose-200 shadow-2xl bg-white/90 text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-800 flex items-center justify-center mx-auto mb-4 shadow-xs">
            <ShieldAlert className="w-7 h-7 text-rose-700" />
          </div>
          <h2 className="text-xl font-bold text-stone-900 mb-2">Acceso No Autorizado (403)</h2>
          <p className="text-xs text-stone-600 leading-relaxed mb-4">
            Has iniciado sesión como <strong className="text-stone-900">{user?.email}</strong> con rol{' '}
            <span className="px-2 py-0.5 rounded-full bg-stone-200 text-stone-800 font-mono font-bold text-[10px]">
              {user?.role}
            </span>. Esta cuenta no cuenta con permisos administrativos en la plataforma.
          </p>
          <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/70 text-[11px] text-amber-900 text-left mb-6">
            <p className="font-bold flex items-center gap-1.5 mb-1 text-amber-950">
              <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>Aprovisionamiento Seguro</span>
            </p>
            <p className="text-amber-800 leading-relaxed">
              Para promover una cuenta existente al rol de administrador, ejecuta en la terminal del servidor:
            </p>
            <code className="block mt-1.5 p-2 rounded-lg bg-white/90 border border-amber-200 font-mono text-[10px] text-stone-800 overflow-x-auto">
              npx tsx scripts/manage-admin.ts promote {user?.email}
            </code>
          </div>
          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => navigate('/')}
              className="w-full py-3 px-4 rounded-xl liquid-btn-primary text-white text-xs font-bold cursor-pointer shadow-md flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Regresar a la Tienda</span>
            </button>
            <button
              onClick={() => {
                logout();
                openAuthModal('login');
              }}
              className="w-full py-2.5 px-4 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-100 text-xs font-semibold cursor-pointer transition-colors"
            >
              Cerrar Sesión / Cambiar Cuenta
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Format currency in Colombian Pesos
  const formatCOP = (val: number) => {
    return `$ ${Math.round(val || 0).toLocaleString('es-CO')} COP`;
  };

  const navItems: { id: AdminTab; label: string; icon: React.FC<{ className?: string }>; badge?: string }[] = [
    { id: 'overview', label: 'Resumen General', icon: LayoutDashboard },
    { id: 'orders', label: 'Gestión de Pedidos', icon: ShoppingBag, badge: overview?.totalOrders?.toString() },
    { id: 'customers', label: 'Clientes Registrados', icon: Users, badge: overview?.totalCustomers?.toString() },
    { id: 'coupons', label: 'Cupones BTL', icon: Tag, badge: overview?.totalCoupons?.toString() },
    { id: 'btl', label: 'Videojuego Pompón', icon: Gamepad2 },
    { id: 'analytics', label: 'Data Analytics', icon: BarChart3, badge: 'Fase 3' },
    { id: 'ml', label: 'Machine Learning', icon: Cpu, badge: 'Fase 4' },
  ];

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#2E2823] font-sans flex flex-col lg:flex-row">
      {/* SIDEBAR NAVIGATION (DESKTOP) */}
      <aside className="w-full lg:w-64 bg-white/85 border-b lg:border-b-0 lg:border-r border-stone-200/80 p-4 lg:p-6 flex flex-col justify-between shrink-0 backdrop-blur-2xl">
        <div>
          {/* Brand Header */}
          <div className="mb-6 pb-4 border-b border-stone-200/60">
            <BrandLogo size="sm" className="mb-2" />
            <div className="flex items-center gap-1.5 mt-1">
              <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-950 font-sans">
                Panel Administrativo
              </span>
            </div>
            <p className="text-[10px] text-stone-500 mt-0.5">Amigurumis Mariai v2.4 (Fase 2F.1)</p>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer ${
                    isActive
                      ? 'bg-stone-900 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-950 hover:bg-stone-100/70'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-stone-500'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-stone-200 text-stone-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Footer & Return to Store */}
        <div className="pt-4 border-t border-stone-200/60 space-y-2 mt-6 lg:mt-0">
          <div className="p-2.5 rounded-xl bg-stone-100/80 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-stone-900 truncate max-w-[120px]">{user?.fullName}</span>
              <span className="px-1.5 py-0.2 rounded-md bg-amber-200/80 text-amber-950 font-extrabold text-[9px]">
                ADMIN
              </span>
            </div>
            <p className="text-[10px] text-stone-500 truncate mt-0.5">{user?.email}</p>
          </div>

          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-stone-200 text-stone-700 hover:text-stone-950 hover:bg-white text-xs font-bold transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-stone-500" />
            <span>Volver a la Tienda</span>
          </button>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-h-screen">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-stone-200/60">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-sans text-stone-950 tracking-tight">
              {activeTab === 'overview' && 'Resumen Ejecutivo'}
              {activeTab === 'orders' && 'Gestión de Pedidos & Despachos'}
              {activeTab === 'customers' && 'Directorio de Clientes'}
              {activeTab === 'coupons' && 'Cupones & Recompensas BTL'}
              {activeTab === 'btl' && 'Telemetría del Videojuego Pompón'}
              {activeTab === 'analytics' && 'Módulo de Data Analytics (Fase 3)'}
              {activeTab === 'ml' && 'Módulo de Machine Learning (Fase 4)'}
            </h1>
            <p className="text-xs text-stone-500 mt-0.5">
              Datos reales sincronizados en tiempo real con SQLite (Modo Demostración Académica).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (activeTab === 'overview') loadOverview();
                else if (activeTab === 'orders') loadOrders();
                else if (activeTab === 'customers') loadCustomers();
                else if (activeTab === 'coupons') loadCoupons();
                else if (activeTab === 'btl') loadBtl();
              }}
              disabled={loadingData}
              className="py-2 px-3.5 rounded-xl liquid-glass border border-stone-200 hover:bg-white text-xs font-bold text-stone-700 flex items-center gap-2 cursor-pointer transition-all shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-700 ${loadingData ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-800 cursor-pointer">
              Cerrar
            </button>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: OVERVIEW / RESUMEN GENERAL */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-3xl liquid-glass border border-white/80 shadow-xs bg-white/75">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                    Ventas Simuladas
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-amber-100/80 text-amber-800 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl font-black text-stone-900 font-sans">
                  {formatCOP(overview?.totalRevenue || 0)}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  Subtotal: {formatCOP(overview?.totalSubtotal || 0)} | Descuentos: {formatCOP(overview?.totalDiscounts || 0)}
                </p>
              </div>

              <div className="p-5 rounded-3xl liquid-glass border border-white/80 shadow-xs bg-white/75">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                    Pedidos Totales
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-blue-100/80 text-blue-800 flex items-center justify-center">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl font-black text-stone-900 font-sans">
                  {overview?.totalOrders || 0}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  Ticket Promedio: {formatCOP(overview?.averageOrderValue || 0)}
                </p>
              </div>

              <div className="p-5 rounded-3xl liquid-glass border border-white/80 shadow-xs bg-white/75">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                    Clientes Registrados
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl font-black text-stone-900 font-sans">
                  {overview?.totalCustomers || 0}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">Cuentas locales en SQLite</p>
              </div>

              <div className="p-5 rounded-3xl liquid-glass border border-white/80 shadow-xs bg-white/75">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                    Partidas BTL & Cupones
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-purple-100/80 text-purple-800 flex items-center justify-center">
                    <Gamepad2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl font-black text-stone-900 font-sans">
                  {overview?.btlGamesPlayed || 0}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  {overview?.btlVictories || 0} victorias | {overview?.totalCouponsRedeemed || 0} cupones canjeados
                </p>
              </div>
            </div>

            {/* Recent Orders Section */}
            <div className="p-6 rounded-3xl liquid-glass border border-white/80 shadow-xs bg-white/80 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-stone-900">Últimos Pedidos Registrados</h3>
                  <p className="text-xs text-stone-500">Órdenes confirmadas en el checkout simulado</p>
                </div>
                <button
                  onClick={() => setActiveTab('orders')}
                  className="text-xs font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1 cursor-pointer"
                >
                  <span>Ver Todos</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {recentOrders.length === 0 ? (
                <p className="text-xs text-stone-500 py-4 text-center">No hay pedidos recientes registrados.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-stone-200/80 text-stone-500 font-bold">
                        <th className="pb-2">N° Pedido</th>
                        <th className="pb-2">Cliente</th>
                        <th className="pb-2">Ciudad</th>
                        <th className="pb-2">Total</th>
                        <th className="pb-2">Estado</th>
                        <th className="pb-2">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {recentOrders.map((ord) => (
                        <tr key={ord.id} className="hover:bg-amber-50/40">
                          <td className="py-2.5 font-bold font-mono text-amber-950">{ord.order_number}</td>
                          <td className="py-2.5">{ord.customer_name}</td>
                          <td className="py-2.5 text-stone-600">{ord.customer_city || 'Bogotá D.C.'}</td>
                          <td className="py-2.5 font-bold">{formatCOP(ord.total)}</td>
                          <td className="py-2.5">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-bold">
                              {ord.status}
                            </span>
                          </td>
                          <td className="py-2.5 text-stone-500 text-[11px]">{ord.created_at?.split('T')[0]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* System Status Banner */}
            <div className="p-5 rounded-3xl bg-amber-50/80 border border-amber-200/70 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Database className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-amber-950">Almacenamiento SQLite Activo & Integridad Verificada</h4>
                  <p className="text-[11px] text-amber-800 leading-relaxed mt-0.5">
                    Modo WAL activo con transacciones atómicas. Datos preservados localmente para evaluación académica.
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-xl bg-amber-700 text-white font-extrabold text-[10px] shrink-0 uppercase tracking-wider">
                Demostración Académica
              </span>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: ORDERS MANAGEMENT */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="p-4 rounded-2xl liquid-glass border border-white/80 shadow-xs flex flex-wrap items-center justify-between gap-3 bg-white/70">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {['todos', 'pedido_recibido', 'en_preparacion', 'enviado', 'entregado'].map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      setOrderStatusFilter(st);
                      loadOrders(1, st);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer capitalize ${
                      orderStatusFilter === st
                        ? 'bg-stone-900 text-white shadow-xs'
                        : 'bg-stone-200/70 text-stone-700 hover:bg-stone-300/60'
                    }`}
                  >
                    {st.replace('_', ' ')}
                  </button>
                ))}
              </div>

              <div className="text-xs text-stone-500 font-semibold">
                Mostrando {orders.length} de {orderTotalCount} pedidos
              </div>
            </div>

            {/* Orders Table */}
            <div className="rounded-3xl liquid-glass border border-white/80 shadow-xs bg-white/85 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-100/90 text-stone-600 font-bold border-b border-stone-200">
                    <tr>
                      <th className="py-3 px-4">N° Pedido</th>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4">Ciudad</th>
                      <th className="py-3 px-4">Método Envío</th>
                      <th className="py-3 px-4">Cupón</th>
                      <th className="py-3 px-4">Total</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-stone-500">
                          No se encontraron órdenes con el filtro seleccionado.
                        </td>
                      </tr>
                    ) : (
                      orders.map((ord) => (
                        <tr key={ord.id} className="hover:bg-amber-50/30 transition-colors">
                          <td className="py-3 px-4 font-bold font-mono text-amber-950">{ord.order_number}</td>
                          <td className="py-3 px-4">
                            <p className="font-bold text-stone-900">{ord.customer_name}</p>
                            <p className="text-[10px] text-stone-500 truncate max-w-[150px]">{ord.customer_email}</p>
                          </td>
                          <td className="py-3 px-4 text-stone-700">{ord.customer_city || 'Bogotá D.C.'}</td>
                          <td className="py-3 px-4 capitalize text-stone-600">{ord.shipping_method}</td>
                          <td className="py-3 px-4">
                            {ord.coupon_code ? (
                              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-mono font-bold text-[10px]">
                                {ord.coupon_code}
                              </span>
                            ) : (
                              <span className="text-stone-400 text-[10px]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-bold text-stone-900">{formatCOP(ord.total)}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-bold">
                              {ord.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-stone-500 text-[11px] whitespace-nowrap">
                            {ord.created_at?.split('T')[0]}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {orderTotalPages > 1 && (
                <div className="p-3 border-t border-stone-200/80 flex items-center justify-between text-xs">
                  <button
                    disabled={orderPage <= 1}
                    onClick={() => loadOrders(orderPage - 1)}
                    className="py-1 px-3 rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-100 disabled:opacity-40 cursor-pointer flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Anterior</span>
                  </button>
                  <span className="text-stone-600 font-semibold">
                    Página {orderPage} de {orderTotalPages}
                  </span>
                  <button
                    disabled={orderPage >= orderTotalPages}
                    onClick={() => loadOrders(orderPage + 1)}
                    className="py-1 px-3 rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-100 disabled:opacity-40 cursor-pointer flex items-center gap-1"
                  >
                    <span>Siguiente</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: CUSTOMERS DIRECTORY */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'customers' && (
          <div className="space-y-4">
            <div className="rounded-3xl liquid-glass border border-white/80 shadow-xs bg-white/85 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-100/90 text-stone-600 font-bold border-b border-stone-200">
                    <tr>
                      <th className="py-3 px-4">Nombre</th>
                      <th className="py-3 px-4">Correo Electrónico</th>
                      <th className="py-3 px-4">Teléfono</th>
                      <th className="py-3 px-4">Ciudad</th>
                      <th className="py-3 px-4">Total Pedidos</th>
                      <th className="py-3 px-4">Gasto Total</th>
                      <th className="py-3 px-4">Fecha Registro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {customers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-stone-500">
                          No hay clientes registrados en la plataforma.
                        </td>
                      </tr>
                    ) : (
                      customers.map((cust) => (
                        <tr key={cust.id} className="hover:bg-amber-50/30 transition-colors">
                          <td className="py-3 px-4 font-bold text-stone-900">{cust.name}</td>
                          <td className="py-3 px-4 font-mono text-stone-600">{cust.email}</td>
                          <td className="py-3 px-4 text-stone-600">{cust.phone || 'No registrado'}</td>
                          <td className="py-3 px-4 text-stone-700">{cust.city || 'Bogotá D.C.'}</td>
                          <td className="py-3 px-4 font-bold text-stone-900">{cust.orders_count || 0}</td>
                          <td className="py-3 px-4 font-bold text-amber-950">{formatCOP(cust.total_spent || 0)}</td>
                          <td className="py-3 px-4 text-stone-500 text-[11px]">{cust.created_at?.split('T')[0]}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {customerTotalPages > 1 && (
                <div className="p-3 border-t border-stone-200/80 flex items-center justify-between text-xs">
                  <button
                    disabled={customerPage <= 1}
                    onClick={() => loadCustomers(customerPage - 1)}
                    className="py-1 px-3 rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-100 disabled:opacity-40 cursor-pointer flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Anterior</span>
                  </button>
                  <span className="text-stone-600 font-semibold">
                    Página {customerPage} de {customerTotalPages}
                  </span>
                  <button
                    disabled={customerPage >= customerTotalPages}
                    onClick={() => loadCustomers(customerPage + 1)}
                    className="py-1 px-3 rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-100 disabled:opacity-40 cursor-pointer flex items-center gap-1"
                  >
                    <span>Siguiente</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 4: COUPONS & BTL REWARDS */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'coupons' && (
          <div className="space-y-4">
            <div className="rounded-3xl liquid-glass border border-white/80 shadow-xs bg-white/85 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-100/90 text-stone-600 font-bold border-b border-stone-200">
                    <tr>
                      <th className="py-3 px-4">Código</th>
                      <th className="py-3 px-4">Descuento</th>
                      <th className="py-3 px-4">Nivel BTL</th>
                      <th className="py-3 px-4">Usos Realizados</th>
                      <th className="py-3 px-4">Límite</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4">Descripción</th>
                      <th className="py-3 px-4">Creación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {coupons.map((c) => (
                      <tr key={c.code} className="hover:bg-amber-50/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-amber-950">{c.code}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[11px]">
                            {c.discount_percent}% OFF
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {c.level_required ? `Nivel ${c.level_required}` : 'Público'}
                        </td>
                        <td className="py-3 px-4 font-bold text-stone-900">{c.times_used}</td>
                        <td className="py-3 px-4 text-stone-500">{c.max_uses > 999 ? 'Ilimitado' : c.max_uses}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              c.is_active ? 'bg-emerald-100 text-emerald-900' : 'bg-stone-200 text-stone-600'
                            }`}
                          >
                            {c.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-stone-600 max-w-[200px] truncate">{c.description}</td>
                        <td className="py-3 px-4 text-stone-500 text-[11px]">{c.created_at?.split('T')[0]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 5: BTL MINIGAME TELEMETRY */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'btl' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-3xl liquid-glass border border-white/80 shadow-xs bg-white/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                    Partidas Iniciadas
                  </span>
                  <Gamepad2 className="w-5 h-5 text-purple-700" />
                </div>
                <div className="text-2xl font-black text-stone-900">{btlSummary?.totalGameRuns || 0}</div>
                <p className="text-[10px] text-stone-500 mt-1">Sesiones de juego registradas</p>
              </div>

              <div className="p-5 rounded-3xl liquid-glass border border-white/80 shadow-xs bg-white/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                    Tasa de Victoria
                  </span>
                  <Award className="w-5 h-5 text-amber-700" />
                </div>
                <div className="text-2xl font-black text-stone-900">{btlSummary?.victoryRate || 0}%</div>
                <p className="text-[10px] text-stone-500 mt-1">
                  {btlSummary?.victories || 0} victorias sobre {btlSummary?.completedSessions || 0} completadas
                </p>
              </div>

              <div className="p-5 rounded-3xl liquid-glass border border-white/80 shadow-xs bg-white/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                    Cupones BTL Generados
                  </span>
                  <Tag className="w-5 h-5 text-emerald-700" />
                </div>
                <div className="text-2xl font-black text-stone-900">{btlSummary?.btlCouponsGenerated || 0}</div>
                <p className="text-[10px] text-stone-500 mt-1">
                  {btlSummary?.btlCouponsRedeemed || 0} redimidos en compras
                </p>
              </div>
            </div>

            {/* Level Breakdown Table */}
            <div className="p-6 rounded-3xl liquid-glass border border-white/80 shadow-xs bg-white/85 space-y-3">
              <h3 className="text-sm font-bold text-stone-900">Rendimiento por Nivel de Dificultad</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-stone-200 text-stone-600 font-bold">
                    <tr>
                      <th className="pb-2">Nivel</th>
                      <th className="pb-2">Nombre del Nivel</th>
                      <th className="pb-2">Intentos</th>
                      <th className="pb-2">Victorias</th>
                      <th className="pb-2">Ovillos Rescatados</th>
                      <th className="pb-2">Puntuación Media</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {[
                      { num: 1, name: 'El Bosque de los Ovillos' },
                      { num: 2, name: 'El Taller Encantado' },
                      { num: 3, name: 'El Castillo de las Puntadas' },
                    ].map((lvl) => {
                      const stat = btlLevelStats.find((s) => s.level === lvl.num);
                      return (
                        <tr key={lvl.num} className="hover:bg-amber-50/30">
                          <td className="py-2.5 font-bold font-mono">0{lvl.num}</td>
                          <td className="py-2.5 font-semibold text-stone-900">{lvl.name}</td>
                          <td className="py-2.5">{stat?.attempts || 0}</td>
                          <td className="py-2.5 text-emerald-700 font-bold">{stat?.victories || 0}</td>
                          <td className="py-2.5">{stat?.wool_collected || 0}</td>
                          <td className="py-2.5 font-mono">{Math.round(stat?.avg_score || 0)} pts</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 6: DATA ANALYTICS (PREPARADO - FASE 3) */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Academic Notice Banner */}
            <div className="p-5 rounded-3xl bg-blue-50/80 border border-blue-200 text-xs text-blue-900 flex items-start gap-3">
              <Layers className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-blue-950">Módulo de Data Analytics (Estructura Lista para Fase 3)</h4>
                  <span className="px-2 py-0.5 rounded-full bg-blue-200 text-blue-900 text-[10px] font-extrabold uppercase">
                    Arquitectura Preparada
                  </span>
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed mt-1">
                  Los contratos tipados de telemetría y eventos ya están definidos en{' '}
                  <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-[10px]">src/types/analytics.ts</code>.
                  Esta sección visual presenta la arquitectura de tableros analíticos que se alimentará en la Fase 3
                  sin alterar la base de datos transaccional actual.
                </p>
              </div>
            </div>

            {/* Conceptual Mockup Visual Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-6 rounded-3xl liquid-glass border border-white/80 shadow-xs bg-white/70 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-stone-900">Evolución Temporal de Ventas</h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-200 text-stone-700">
                    Pipeline OLAP Pendiente
                  </span>
                </div>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Agregación diaria y semanal de pedidos confirmados versus canje de cupones BTL.
                </p>
                <div className="h-36 rounded-2xl bg-stone-100/80 border border-dashed border-stone-300 flex flex-col items-center justify-center p-4 text-center">
                  <BarChart3 className="w-8 h-8 text-stone-400 mb-1" />
                  <p className="text-xs font-bold text-stone-600">Visualización de Series Temporales</p>
                  <p className="text-[10px] text-stone-400">Contratos: TimeSeriesPoint / CommercialKpisSummary</p>
                </div>
              </div>

              <div className="p-6 rounded-3xl liquid-glass border border-white/80 shadow-xs bg-white/70 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-stone-900">Embudo de Conversión Comercial</h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-200 text-stone-700">
                    Telemetría Lista
                  </span>
                </div>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Trazabilidad: Catálogo &rarr; Bolsa de Compras &rarr; Checkout &rarr; Pedido Confirmado &rarr; Descarga PDF.
                </p>
                <div className="h-36 rounded-2xl bg-stone-100/80 border border-dashed border-stone-300 flex flex-col items-center justify-center p-4 text-center">
                  <TrendingUp className="w-8 h-8 text-stone-400 mb-1" />
                  <p className="text-xs font-bold text-stone-600">Embudo Multietapa</p>
                  <p className="text-[10px] text-stone-400">Contratos: CommercialEventType en analytics.ts</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 7: MACHINE LEARNING (PREPARADO - FASE 4) */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'ml' && (
          <div className="space-y-6">
            {/* Academic Notice Banner */}
            <div className="p-5 rounded-3xl bg-purple-50/80 border border-purple-200 text-xs text-purple-900 flex items-start gap-3">
              <Cpu className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-purple-950">Módulo de Machine Learning (Contratos Preparados para Fase 4)</h4>
                  <span className="px-2 py-0.5 rounded-full bg-purple-200 text-purple-900 text-[10px] font-extrabold uppercase">
                    Esquemas Sin Inferencia Ficticia
                  </span>
                </div>
                <p className="text-[11px] text-purple-800 leading-relaxed mt-1">
                  En cumplimiento del rigor de ingeniería de software, este panel no simula predicciones aleatorias ni
                  ejecuta modelos ficticios. Define la infraestructura conceptual para modelos entrenables con datos reales.
                </p>
              </div>
            </div>

            {/* Model Architecture Blueprint Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-3xl liquid-glass border border-white/80 shadow-xs bg-white/75 space-y-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center mb-1">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-stone-900">Motor de Recomendaciones</h4>
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  Filtrado colaborativo basado en patrones de compra y personajes preferidos en el videojuego de Pompón.
                </p>
                <div className="pt-2 text-[10px] font-mono text-purple-900 font-bold">
                  Interface: RecommendationInference
                </div>
              </div>

              <div className="p-5 rounded-3xl liquid-glass border border-white/80 shadow-xs bg-white/75 space-y-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-1">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-stone-900">Predicción de Demanda Artesanal</h4>
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  Estimación de consumo de hilados de algodón peinado, ojos de seguridad y horas de confección por temporada.
                </p>
                <div className="pt-2 text-[10px] font-mono text-amber-900 font-bold">
                  Interface: DemandForecastResult
                </div>
              </div>

              <div className="p-5 rounded-3xl liquid-glass border border-white/80 shadow-xs bg-white/75 space-y-2">
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center mb-1">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-stone-900">Detección de Fraude en Cupones</h4>
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  Clasificación de anomalías para identificar reclamos automáticos de recompensas BTL sin jugabilidad humana.
                </p>
                <div className="pt-2 text-[10px] font-mono text-rose-900 font-bold">
                  Interface: AnomalyDetectionPayload
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
