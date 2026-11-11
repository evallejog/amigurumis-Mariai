import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from '../components/common/BrandLogo';
import {
  LayoutDashboard,
  ShoppingBag,
  Users,
  User,
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
  Filter,
  Plus,
  X,
  Calendar,
  History,
  ArrowRight,
  Check
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
  coupon_type?: 'commercial' | 'commercial_general' | 'commercial_exclusive' | 'btl';
  target_type?: 'general' | 'exclusive';
  level_required?: number;
  max_uses: number;
  times_used: number;
  is_active: number;
  description?: string;
  created_at: string;
  expires_at?: string;
  user_id?: string;
  user_email?: string;
  owner_name?: string;
  owner_email?: string;
}

interface StatusHistoryRecord {
  id: string;
  order_id: string;
  previous_status: string;
  new_status: string;
  admin_id: string;
  admin_email: string;
  notes?: string;
  created_at: string;
}

interface BtlLevelStat {
  level: number;
  attempts: number;
  victories: number;
  wool_collected: number;
  avg_score: number;
  avg_time: number;
}

const NEXT_ORDER_STATUS: Record<string, { next: string; label: string; color: string }> = {
  pedido_recibido: { next: 'en_preparacion', label: 'Iniciar Preparación', color: 'bg-amber-600 hover:bg-amber-700 text-white' },
  en_preparacion: { next: 'enviado', label: 'Marcar como Enviado', color: 'bg-blue-600 hover:bg-blue-700 text-white' },
  enviado: { next: 'entregado', label: 'Confirmar Entrega', color: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
};

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
  const [orderStartDate, setOrderStartDate] = useState<string>('');
  const [orderEndDate, setOrderEndDate] = useState<string>('');

  // Status transition modal state
  const [statusModalOrder, setStatusModalOrder] = useState<OrderRecord | null>(null);
  const [statusModalNextStatus, setStatusModalNextStatus] = useState<string>('');
  const [statusModalNotes, setStatusModalNotes] = useState<string>('');
  const [isSubmittingStatus, setIsSubmittingStatus] = useState<boolean>(false);
  const [statusActionError, setStatusActionError] = useState<string | null>(null);

  // History audit modal state
  const [historyModalOrder, setHistoryModalOrder] = useState<OrderRecord | null>(null);
  const [historyList, setHistoryList] = useState<StatusHistoryRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Customers table state
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [customerPage, setCustomerPage] = useState<number>(1);
  const [customerTotalPages, setCustomerTotalPages] = useState<number>(1);
  const [customerTotalCount, setCustomerTotalCount] = useState<number>(0);
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [customerStartDate, setCustomerStartDate] = useState<string>('');
  const [customerEndDate, setCustomerEndDate] = useState<string>('');

  // Coupons table state
  const [coupons, setCoupons] = useState<CouponRecord[]>([]);
  const [couponTypeFilter, setCouponTypeFilter] = useState<string>('all');
  const [couponStatusFilter, setCouponStatusFilter] = useState<string>('all');
  const [couponSearch, setCouponSearch] = useState<string>('');
  const [couponPage, setCouponPage] = useState<number>(1);
  const [couponTotalPages, setCouponTotalPages] = useState<number>(1);
  const [couponTotalCount, setCouponTotalCount] = useState<number>(0);
  const [customerOptions, setCustomerOptions] = useState<{ id: string; name: string; email: string }[]>([]);

  const [isCouponModalOpen, setIsCouponModalOpen] = useState<boolean>(false);
  const [couponForm, setCouponForm] = useState({
    code: '',
    discountPercent: 10,
    maxUses: 100,
    expiresAt: '',
    description: '',
    isActive: true,
    targetType: 'general' as 'general' | 'exclusive',
    userId: '',
  });
  const [isSubmittingCoupon, setIsSubmittingCoupon] = useState<boolean>(false);
  const [couponModalError, setCouponModalError] = useState<string | null>(null);
  const [couponModalSuccess, setCouponModalSuccess] = useState<string | null>(null);

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

  const loadOrders = async (
    page = orderPage,
    status = orderStatusFilter,
    search = orderSearch,
    startDate = orderStartDate,
    endDate = orderEndDate
  ) => {
    try {
      setLoadingData(true);
      const query = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(status !== 'todos' ? { status } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
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

  const loadCustomers = async (
    page = customerPage,
    search = customerSearch,
    startDate = customerStartDate,
    endDate = customerEndDate
  ) => {
    try {
      setLoadingData(true);
      const query = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
      });
      const res = await fetch(`/api/admin/customers?${query.toString()}`, { headers: getAuthHeaders() });
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

  const loadCoupons = async (
    page = couponPage,
    type = couponTypeFilter,
    status = couponStatusFilter,
    search = couponSearch
  ) => {
    try {
      setLoadingData(true);
      const query = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(type !== 'all' ? { type } : {}),
        ...(status !== 'all' ? { status } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      });
      const res = await fetch(`/api/admin/coupons?${query.toString()}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Error al consultar cupones.');
      const data = await res.json();
      setCoupons(data.coupons || []);
      if (data.pagination) {
        setCouponPage(data.pagination.page);
        setCouponTotalPages(data.pagination.totalPages);
        setCouponTotalCount(data.pagination.total);
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoadingData(false);
    }
  };

  const handleOpenCreateCouponModal = async () => {
    setCouponModalError(null);
    setCouponModalSuccess(null);
    setIsCouponModalOpen(true);
    if (customerOptions.length === 0) {
      try {
        const res = await fetch('/api/admin/customers?limit=50', { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          setCustomerOptions((data.customers || []).map((c: any) => ({ id: c.id, name: c.name, email: c.email })));
        }
      } catch {}
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

  // Order status transition handlers
  const handleOpenStatusModal = (order: OrderRecord) => {
    const nextConfig = NEXT_ORDER_STATUS[order.status];
    if (!nextConfig) return;
    setStatusModalOrder(order);
    setStatusModalNextStatus(nextConfig.next);
    setStatusModalNotes('');
    setStatusActionError(null);
  };

  const confirmStatusTransition = async () => {
    if (!statusModalOrder || !statusModalNextStatus || isSubmittingStatus) return;
    try {
      setIsSubmittingStatus(true);
      setStatusActionError(null);
      const res = await fetch(`/api/admin/orders/${statusModalOrder.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          status: statusModalNextStatus,
          notes: statusModalNotes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al actualizar estado del pedido.');
      }

      // Close modal and refresh current orders and overview
      setStatusModalOrder(null);
      setStatusModalNotes('');
      loadOrders(orderPage, orderStatusFilter, orderSearch, orderStartDate, orderEndDate);
      loadOverview();
    } catch (err: any) {
      setStatusActionError(err.message);
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  // Audit history handler
  const handleOpenHistoryModal = async (order: OrderRecord) => {
    setHistoryModalOrder(order);
    setHistoryList([]);
    setHistoryError(null);
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/history`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al obtener historial del pedido.');
      }
      setHistoryList(data.history || []);
    } catch (err: any) {
      setHistoryError(err.message);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Toggle active/inactive for coupons
  const handleToggleCouponActive = async (coupon: CouponRecord) => {
    try {
      setErrorMessage(null);
      const newStatus = coupon.is_active ? false : true;
      const res = await fetch(`/api/admin/coupons/${coupon.code}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          isActive: newStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'No se pudo actualizar el cupón.');
        return;
      }
      loadCoupons(couponPage, couponTypeFilter, couponStatusFilter, couponSearch);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de conexión.');
    }
  };

  // Create commercial coupon
  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingCoupon) return;
    setCouponModalError(null);
    setCouponModalSuccess(null);
    setIsSubmittingCoupon(true);

    try {
      if (couponForm.targetType === 'exclusive' && !couponForm.userId) {
        throw new Error('Debes seleccionar un cliente registrado para emitir un cupón exclusivo.');
      }

      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          code: couponForm.code.trim().toUpperCase(),
          discountPercent: Number(couponForm.discountPercent),
          maxUses: couponForm.targetType === 'exclusive' ? (Number(couponForm.maxUses) || 1) : Number(couponForm.maxUses),
          expiresAt: couponForm.expiresAt ? new Date(couponForm.expiresAt).toISOString() : null,
          description: couponForm.description.trim(),
          isActive: couponForm.isActive,
          targetType: couponForm.targetType,
          userId: couponForm.targetType === 'exclusive' ? couponForm.userId : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al crear cupón.');
      }

      setCouponModalSuccess(`¡Cupón ${data.coupon.code} creado exitosamente!`);
      setTimeout(() => {
        setIsCouponModalOpen(false);
        setCouponModalSuccess(null);
        setCouponForm({
          code: '',
          discountPercent: 10,
          maxUses: 100,
          expiresAt: '',
          description: '',
          isActive: true,
          targetType: 'general',
          userId: '',
        });
        loadCoupons(1, couponTypeFilter, couponStatusFilter, couponSearch);
      }, 1200);
    } catch (err: any) {
      setCouponModalError(err.message);
    } finally {
      setIsSubmittingCoupon(false);
    }
  };

  // Initial load when tab changes or admin confirms auth
  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') return;

    if (activeTab === 'overview') loadOverview();
    else if (activeTab === 'orders') loadOrders(1, orderStatusFilter, orderSearch, orderStartDate, orderEndDate);
    else if (activeTab === 'customers') loadCustomers(1, customerSearch, customerStartDate, customerEndDate);
    else if (activeTab === 'coupons') loadCoupons(1, couponTypeFilter, couponStatusFilter, couponSearch);
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
              Inicia sesión con la cuenta administrativa institucional autorizada (<strong className="text-stone-900">admin@amigurumismariai.com</strong>). Para aprovisionar o gestionar credenciales en el servidor:
            </p>
            <code className="block mt-1.5 p-2 rounded-lg bg-white/90 border border-amber-200 font-mono text-[10px] text-stone-800 overflow-x-auto">
              npx tsx scripts/manage-admin.ts provision-admin
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
                  <table className="w-full text-left text-xs min-w-[650px]">
                    <thead>
                      <tr className="border-b border-stone-200/80 text-stone-500 font-bold">
                        <th className="pb-2 whitespace-nowrap">N° Pedido</th>
                        <th className="pb-2 whitespace-nowrap">Cliente</th>
                        <th className="pb-2 whitespace-nowrap">Ciudad</th>
                        <th className="pb-2 whitespace-nowrap">Total</th>
                        <th className="pb-2 whitespace-nowrap">Estado</th>
                        <th className="pb-2 whitespace-nowrap">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {recentOrders.map((ord) => (
                        <tr key={ord.id} className="hover:bg-amber-50/40">
                          <td className="py-2.5 font-bold font-mono text-amber-950 whitespace-nowrap">{ord.order_number}</td>
                          <td className="py-2.5 whitespace-nowrap">{ord.customer_name}</td>
                          <td className="py-2.5 text-stone-600 whitespace-nowrap">{ord.customer_city || 'Bogotá D.C.'}</td>
                          <td className="py-2.5 font-bold whitespace-nowrap">{formatCOP(ord.total)}</td>
                          <td className="py-2.5 whitespace-nowrap">
                            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-bold whitespace-nowrap shrink-0 border border-emerald-300">
                              {ord.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-2.5 text-stone-500 text-[11px] whitespace-nowrap">{ord.created_at?.split('T')[0]}</td>
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
            {/* Filter & Search Bar */}
            <div className="p-4 rounded-3xl liquid-glass border border-white/80 shadow-xs bg-white/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {['todos', 'pedido_recibido', 'en_preparacion', 'enviado', 'entregado'].map((st) => (
                    <button
                      key={st}
                      onClick={() => {
                        setOrderStatusFilter(st);
                        loadOrders(1, st, orderSearch, orderStartDate, orderEndDate);
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

              {/* Parameterized Search and Date Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 border-t border-stone-200/60">
                <div className="sm:col-span-5 relative">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        loadOrders(1, orderStatusFilter, orderSearch, orderStartDate, orderEndDate);
                      }
                    }}
                    placeholder="Buscar por N° pedido, cliente o email..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/90 border border-stone-200 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>

                <div className="sm:col-span-3 flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-stone-500 shrink-0">Desde:</span>
                  <input
                    type="date"
                    value={orderStartDate}
                    onChange={(e) => setOrderStartDate(e.target.value)}
                    className="w-full py-1.5 px-2.5 rounded-xl bg-white/90 border border-stone-200 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>

                <div className="sm:col-span-3 flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-stone-500 shrink-0">Hasta:</span>
                  <input
                    type="date"
                    value={orderEndDate}
                    onChange={(e) => setOrderEndDate(e.target.value)}
                    className="w-full py-1.5 px-2.5 rounded-xl bg-white/90 border border-stone-200 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>

                <div className="sm:col-span-1 flex items-center gap-1">
                  <button
                    onClick={() => loadOrders(1, orderStatusFilter, orderSearch, orderStartDate, orderEndDate)}
                    className="w-full py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer transition-colors shadow-xs flex items-center justify-center"
                    title="Aplicar filtros"
                  >
                    <Filter className="w-3.5 h-3.5" />
                  </button>
                  {(orderSearch || orderStartDate || orderEndDate || orderStatusFilter !== 'todos') && (
                    <button
                      onClick={() => {
                        setOrderSearch('');
                        setOrderStartDate('');
                        setOrderEndDate('');
                        setOrderStatusFilter('todos');
                        loadOrders(1, 'todos', '', '', '');
                      }}
                      className="py-2 px-2.5 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-700 font-bold text-xs cursor-pointer transition-colors"
                      title="Limpiar filtros"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Orders Table */}
            <div className="rounded-3xl liquid-glass border border-white/80 shadow-xs bg-white/85 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[960px]">
                  <thead className="bg-stone-100/90 text-stone-600 font-bold border-b border-stone-200">
                    <tr>
                      <th className="py-3 px-4 min-w-[130px] whitespace-nowrap">N° Pedido</th>
                      <th className="py-3 px-4 min-w-[170px] whitespace-nowrap">Cliente</th>
                      <th className="py-3 px-4 min-w-[110px] whitespace-nowrap">Ciudad</th>
                      <th className="py-3 px-4 min-w-[100px] whitespace-nowrap">Envío</th>
                      <th className="py-3 px-4 min-w-[110px] whitespace-nowrap">Cupón</th>
                      <th className="py-3 px-4 min-w-[110px] whitespace-nowrap">Total</th>
                      <th className="py-3 px-4 min-w-[150px] whitespace-nowrap">Estado</th>
                      <th className="py-3 px-4 min-w-[105px] whitespace-nowrap">Fecha</th>
                      <th className="py-3 px-4 min-w-[160px] whitespace-nowrap text-center">Gestión Operativa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-10 text-center text-stone-500">
                           No se encontraron órdenes con los criterios especificados.
                        </td>
                      </tr>
                    ) : (
                      orders.map((ord) => {
                        const nextConfig = NEXT_ORDER_STATUS[ord.status];
                        return (
                          <tr key={ord.id} className="hover:bg-amber-50/30 transition-colors">
                            <td className="py-3 px-4 font-bold font-mono text-amber-950 whitespace-nowrap">{ord.order_number}</td>
                            <td className="py-3 px-4">
                              <p className="font-bold text-stone-900">{ord.customer_name}</p>
                              <p className="text-[10px] text-stone-500 truncate max-w-[150px]">{ord.customer_email}</p>
                            </td>
                            <td className="py-3 px-4 text-stone-700 whitespace-nowrap">{ord.customer_city || 'Bogotá D.C.'}</td>
                            <td className="py-3 px-4 capitalize text-stone-600 whitespace-nowrap">{ord.shipping_method}</td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {ord.coupon_code ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-mono font-bold text-[10px] whitespace-nowrap shrink-0 border border-amber-300">
                                  {ord.coupon_code}
                                </span>
                              ) : (
                                <span className="text-stone-400 text-[10px]">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-bold text-stone-900 whitespace-nowrap">{formatCOP(ord.total)}</td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap shrink-0 shadow-2xs ${
                                  ord.status === 'entregado'
                                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                    : ord.status === 'enviado'
                                    ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                    : ord.status === 'en_preparacion'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-stone-200 text-stone-800 border border-stone-300'
                                }`}
                              >
                                {ord.status.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-stone-500 text-[11px] whitespace-nowrap">
                              {ord.created_at?.split('T')[0]}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-center gap-1.5">
                                {nextConfig ? (
                                  <button
                                    onClick={() => handleOpenStatusModal(ord)}
                                    className={`py-1.5 px-2.5 rounded-xl text-[10px] font-bold cursor-pointer transition-all shadow-xs flex items-center gap-1 ${nextConfig.color}`}
                                    title={`Avanzar a ${nextConfig.next.replace('_', ' ')}`}
                                  >
                                    <span>{nextConfig.label}</span>
                                    <ArrowRight className="w-3 h-3" />
                                  </button>
                                ) : (
                                  <span className="py-1 px-2 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold flex items-center gap-1 border border-emerald-200">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Finalizado</span>
                                  </span>
                                )}

                                <button
                                  onClick={() => handleOpenHistoryModal(ord)}
                                  className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10px] font-bold cursor-pointer transition-colors"
                                  title="Ver historial de auditoría"
                                >
                                  <History className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {orderTotalPages > 1 && (
                <div className="p-3 border-t border-stone-200/80 flex items-center justify-between text-xs">
                  <button
                    disabled={orderPage <= 1}
                    onClick={() => loadOrders(orderPage - 1, orderStatusFilter, orderSearch, orderStartDate, orderEndDate)}
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
                    onClick={() => loadOrders(orderPage + 1, orderStatusFilter, orderSearch, orderStartDate, orderEndDate)}
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
            {/* Filter Bar for Customers */}
            <div className="p-4 rounded-3xl liquid-glass border border-white/80 shadow-xs bg-white/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-bold text-stone-700">Filtros de Clientes Registrados</span>
                <span className="text-xs text-stone-500 font-semibold">
                  Mostrando {customers.length} de {customerTotalCount} clientes
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 border-t border-stone-200/60">
                <div className="sm:col-span-5 relative">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        loadCustomers(1, customerSearch, customerStartDate, customerEndDate);
                      }
                    }}
                    placeholder="Buscar por nombre, correo, teléfono o ciudad..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/90 border border-stone-200 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>

                <div className="sm:col-span-3 flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-stone-500 shrink-0">Desde:</span>
                  <input
                    type="date"
                    value={customerStartDate}
                    onChange={(e) => setCustomerStartDate(e.target.value)}
                    className="w-full py-1.5 px-2.5 rounded-xl bg-white/90 border border-stone-200 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>

                <div className="sm:col-span-3 flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-stone-500 shrink-0">Hasta:</span>
                  <input
                    type="date"
                    value={customerEndDate}
                    onChange={(e) => setCustomerEndDate(e.target.value)}
                    className="w-full py-1.5 px-2.5 rounded-xl bg-white/90 border border-stone-200 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>

                <div className="sm:col-span-1 flex items-center gap-1">
                  <button
                    onClick={() => loadCustomers(1, customerSearch, customerStartDate, customerEndDate)}
                    className="w-full py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer transition-colors shadow-xs flex items-center justify-center"
                    title="Aplicar filtros"
                  >
                    <Filter className="w-3.5 h-3.5" />
                  </button>
                  {(customerSearch || customerStartDate || customerEndDate) && (
                    <button
                      onClick={() => {
                        setCustomerSearch('');
                        setCustomerStartDate('');
                        setCustomerEndDate('');
                        loadCustomers(1, '', '', '');
                      }}
                      className="py-2 px-2.5 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-700 font-bold text-xs cursor-pointer transition-colors"
                      title="Limpiar filtros"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

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
                          No se encontraron clientes registrados con los filtros seleccionados.
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
                    onClick={() => loadCustomers(customerPage - 1, customerSearch, customerStartDate, customerEndDate)}
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
                    onClick={() => loadCustomers(customerPage + 1, customerSearch, customerStartDate, customerEndDate)}
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
            {/* Action Bar */}
            <div className="p-4 rounded-3xl liquid-glass border border-white/80 shadow-xs bg-white/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900">Gestión de Cupones Comerciales & Recompensas BTL</h3>
                <p className="text-xs text-stone-500">
                  Los cupones BTL derivan de la superación de niveles en el minijuego de Pompón. Los cupones comerciales son creados por la administración.
                </p>
              </div>

              <button
                onClick={handleOpenCreateCouponModal}
                className="py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer transition-all shadow-xs flex items-center gap-2 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Crear Cupón Comercial</span>
              </button>
            </div>

            {/* Filter & Search Bar for Coupons */}
            <div className="p-4 rounded-3xl liquid-glass border border-white/80 shadow-xs bg-white/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {[
                    { id: 'all', label: 'Todos' },
                    { id: 'btl', label: 'Recompensas BTL' },
                    { id: 'commercial_general', label: 'Comercial General' },
                    { id: 'commercial_exclusive', label: 'Exclusivo Cliente' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setCouponTypeFilter(t.id);
                        loadCoupons(1, t.id, couponStatusFilter, couponSearch);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        couponTypeFilter === t.id
                          ? 'bg-stone-900 text-white shadow-xs'
                          : 'bg-stone-200/70 text-stone-700 hover:bg-stone-300/60'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="text-xs text-stone-500 font-semibold">
                  Mostrando {coupons.length} de {couponTotalCount || coupons.length} cupones
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 border-t border-stone-200/60">
                <div className="sm:col-span-6 relative">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={couponSearch}
                    onChange={(e) => setCouponSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        loadCoupons(1, couponTypeFilter, couponSearch, couponStatusFilter);
                      }
                    }}
                    placeholder="Buscar por código, cliente o descripción..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/90 border border-stone-200 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>

                <div className="sm:col-span-4 flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-stone-500 shrink-0">Estado:</span>
                  <select
                    value={couponStatusFilter}
                    onChange={(e) => {
                      setCouponStatusFilter(e.target.value);
                      loadCoupons(1, couponTypeFilter, e.target.value, couponSearch);
                    }}
                    className="w-full py-1.5 px-2.5 rounded-xl bg-white/90 border border-stone-200 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  >
                    <option value="all">Todos los estados</option>
                    <option value="active">Solo Activos</option>
                    <option value="inactive">Solo Inactivos</option>
                  </select>
                </div>

                <div className="sm:col-span-2 flex items-center gap-1">
                  <button
                    onClick={() => loadCoupons(1, couponTypeFilter, couponStatusFilter, couponSearch)}
                    className="w-full py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer transition-colors shadow-xs flex items-center justify-center gap-1"
                    title="Aplicar filtros"
                  >
                    <Filter className="w-3.5 h-3.5" />
                    <span>Filtrar</span>
                  </button>
                  {(couponSearch || couponTypeFilter !== 'all' || couponStatusFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setCouponSearch('');
                        setCouponTypeFilter('all');
                        setCouponStatusFilter('all');
                        loadCoupons(1, 'all', 'all', '');
                      }}
                      className="py-2 px-2.5 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-700 font-bold text-xs cursor-pointer transition-colors shrink-0"
                      title="Limpiar filtros"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Coupons Table */}
            <div className="rounded-3xl liquid-glass border border-white/80 shadow-xs bg-white/85 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[1100px]">
                  <thead className="bg-stone-100/90 text-stone-600 font-bold border-b border-stone-200">
                    <tr>
                      <th className="py-3 px-4 min-w-[170px] whitespace-nowrap">Código</th>
                      <th className="py-3 px-4 min-w-[160px] whitespace-nowrap">Tipo</th>
                      <th className="py-3 px-4 min-w-[190px] whitespace-nowrap">Destinatario / Cliente</th>
                      <th className="py-3 px-4 min-w-[110px] whitespace-nowrap">Descuento</th>
                      <th className="py-3 px-4 min-w-[130px] whitespace-nowrap">Origen / Nivel</th>
                      <th className="py-3 px-4 min-w-[110px] whitespace-nowrap">Usos / Límite</th>
                      <th className="py-3 px-4 min-w-[120px] whitespace-nowrap">Vencimiento</th>
                      <th className="py-3 px-4 min-w-[110px] whitespace-nowrap">Estado</th>
                      <th className="py-3 px-4 min-w-[110px] whitespace-nowrap text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {coupons.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-10 text-center text-stone-500">
                          No se encontraron cupones con los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      coupons.map((c) => {
                        const isBtl = c.coupon_type === 'btl' || c.code.startsWith('MARIAI-');
                        const isExclusive = c.target_type === 'exclusive' || c.coupon_type === 'commercial_exclusive' || Boolean(c.user_id) || Boolean(c.user_email);
                        return (
                          <tr key={c.code} className="hover:bg-amber-50/30 transition-colors">
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="font-mono font-bold text-stone-900 block">{c.code}</span>
                              <span className="text-[10px] text-stone-500 truncate max-w-[180px] block">{c.description}</span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {isBtl ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 font-bold text-[10px] border border-purple-200 whitespace-nowrap shrink-0">
                                  Recompensa BTL
                                </span>
                              ) : isExclusive ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px] border border-amber-300 whitespace-nowrap shrink-0">
                                  Exclusivo Cliente
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 font-bold text-[10px] border border-blue-200 whitespace-nowrap shrink-0">
                                  Comercial General
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {c.owner_name || c.owner_email || c.user_email ? (
                                <div className="flex items-center gap-1.5 whitespace-nowrap">
                                  <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-[10px] font-bold shrink-0">
                                    <User className="w-3 h-3" />
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-bold text-stone-900 truncate max-w-[160px] block">
                                      {c.owner_name || 'Cliente registrado'}
                                    </span>
                                    <span className="text-[10px] text-stone-500 font-mono truncate max-w-[160px] block">
                                      {c.owner_email || c.user_email}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-stone-500 whitespace-nowrap">
                                  <Users className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                                  <span className="text-[11px] font-medium">Todos los clientes</span>
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-extrabold text-[11px] whitespace-nowrap shrink-0 border border-amber-300/70">
                                {c.discount_percent}% OFF
                              </span>
                            </td>
                            <td className="py-3 px-4 text-stone-700 whitespace-nowrap">
                              {c.level_required ? `Nivel 0${c.level_required}` : 'Campaña Comercial'}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="font-bold text-stone-900">{c.times_used}</span>
                              <span className="text-stone-400"> / {c.max_uses > 999 ? '∞' : c.max_uses}</span>
                            </td>
                            <td className="py-3 px-4 text-stone-500 text-[11px] whitespace-nowrap">
                              {c.expires_at ? c.expires_at.split('T')[0] : 'Sin vencimiento'}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap shrink-0 ${
                                  c.is_active
                                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                    : 'bg-stone-200 text-stone-600 border border-stone-300'
                                }`}
                              >
                                {c.is_active ? 'Activo' : 'Inactivo'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <button
                                onClick={() => handleToggleCouponActive(c)}
                                className={`py-1 px-2.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                                  c.is_active
                                    ? 'bg-rose-100 hover:bg-rose-200 text-rose-800'
                                    : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                                }`}
                              >
                                {c.is_active ? 'Desactivar' : 'Activar'}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls for Coupons */}
              {couponTotalPages > 1 && (
                <div className="p-3 border-t border-stone-200/80 flex items-center justify-between text-xs">
                  <button
                    disabled={couponPage <= 1}
                    onClick={() => loadCoupons(couponPage - 1, couponTypeFilter, couponStatusFilter, couponSearch)}
                    className="py-1 px-3 rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-100 disabled:opacity-40 cursor-pointer flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Anterior</span>
                  </button>
                  <span className="text-stone-600 font-semibold">
                    Página {couponPage} de {couponTotalPages}
                  </span>
                  <button
                    disabled={couponPage >= couponTotalPages}
                    onClick={() => loadCoupons(couponPage + 1, couponTypeFilter, couponStatusFilter, couponSearch)}
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
        {/* ============================================================= */}
        {/* MODAL 1: ORDER STATUS TRANSITION CONFIRMATION */}
        {/* ============================================================= */}
        {statusModalOrder && (
          <div className="fixed inset-0 bg-stone-950/50 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white/95 rounded-3xl border border-white/80 shadow-2xl p-6 sm:p-7 space-y-5 animate-fadeIn">
              <div className="flex items-center justify-between pb-3 border-b border-stone-200/70">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900">Actualizar Estado de Pedido</h3>
                    <p className="text-[11px] font-mono text-amber-900 font-bold">{statusModalOrder.order_number}</p>
                  </div>
                </div>
                <button
                  onClick={() => setStatusModalOrder(null)}
                  disabled={isSubmittingStatus}
                  className="p-1 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status transition diagram */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 flex items-center justify-between gap-2">
                <div className="text-center flex-1">
                  <span className="text-[10px] uppercase font-bold text-stone-500 block">Actual</span>
                  <span className="px-2.5 py-1 rounded-lg bg-stone-200 text-stone-800 font-bold text-xs inline-block mt-1">
                    {statusModalOrder.status.replace('_', ' ')}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-600 shrink-0" />
                <div className="text-center flex-1">
                  <span className="text-[10px] uppercase font-bold text-stone-500 block">Siguiente</span>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-bold text-xs inline-block mt-1 shadow-xs">
                    {statusModalNextStatus.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Customer summary */}
              <div className="text-xs text-stone-600 space-y-1 bg-amber-50/50 p-3 rounded-xl border border-amber-200/40">
                <p><strong className="text-stone-800">Cliente:</strong> {statusModalOrder.customer_name} ({statusModalOrder.customer_email})</p>
                <p><strong className="text-stone-800">Total:</strong> {formatCOP(statusModalOrder.total)} | Envío: {statusModalOrder.shipping_method}</p>
              </div>

              {/* Optional Admin Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-700 block">
                  Observaciones / Notas de Auditoría (Opcional):
                </label>
                <textarea
                  value={statusModalNotes}
                  onChange={(e) => setStatusModalNotes(e.target.value)}
                  placeholder="Ej: Paquete empacado en taller. Guía de Servientrega #992819..."
                  rows={3}
                  className="w-full p-3 rounded-2xl bg-white border border-stone-200 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
              </div>

              {statusActionError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{statusActionError}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setStatusModalOrder(null)}
                  disabled={isSubmittingStatus}
                  className="py-2 px-4 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-100 text-xs font-bold cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmStatusTransition}
                  disabled={isSubmittingStatus}
                  className="py-2.5 px-5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmittingStatus ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Guardando en SQLite...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirmar Transición</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* MODAL 2: ORDER AUDIT HISTORY TIMELINE */}
        {/* ============================================================= */}
        {historyModalOrder && (
          <div className="fixed inset-0 bg-stone-950/50 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white/95 rounded-3xl border border-white/80 shadow-2xl p-6 sm:p-7 space-y-4 animate-fadeIn max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-stone-200/70 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-800 flex items-center justify-center">
                    <History className="w-4 h-4 text-amber-700" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900">Historial de Auditoría de Estados</h3>
                    <p className="text-[11px] font-mono text-stone-500">Orden: <strong className="text-stone-900">{historyModalOrder.order_number}</strong></p>
                  </div>
                </div>
                <button
                  onClick={() => setHistoryModalOrder(null)}
                  className="p-1 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 space-y-3">
                {isLoadingHistory ? (
                  <div className="py-12 text-center flex flex-col items-center gap-2">
                    <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-stone-500">Cargando registros de auditoría...</span>
                  </div>
                ) : historyError ? (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                    {historyError}
                  </div>
                ) : historyList.length === 0 ? (
                  <div className="py-8 text-center text-xs text-stone-500 space-y-2">
                    <Clock className="w-8 h-8 text-stone-300 mx-auto" />
                    <p>Este pedido aún no registra transiciones administrativas posteriores a su creación.</p>
                    <p className="text-[10px] text-stone-400">Estado inicial: <strong className="text-stone-600">{historyModalOrder.status}</strong></p>
                  </div>
                ) : (
                  <div className="space-y-3 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200">
                    {historyList.map((rec) => (
                      <div key={rec.id} className="relative pl-8 text-xs">
                        <div className="absolute left-2 top-1.5 w-3.5 h-3.5 rounded-full bg-amber-600 border-2 border-white shadow-xs" />
                        <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200/70 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-stone-900">
                              {rec.previous_status.replace('_', ' ')} &rarr;{' '}
                              <span className="text-amber-800">{rec.new_status.replace('_', ' ')}</span>
                            </span>
                            <span className="text-[10px] text-stone-400 font-mono">
                              {new Date(rec.created_at).toLocaleString('es-CO')}
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-600">
                            Por admin: <strong className="text-stone-800 font-mono">{rec.admin_email}</strong>
                          </p>
                          {rec.notes && (
                            <p className="text-[11px] text-stone-700 bg-white p-2 rounded-xl border border-stone-200/50 mt-1 italic">
                              "{rec.notes}"
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-stone-200/70 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setHistoryModalOrder(null)}
                  className="py-2 px-4 rounded-xl bg-stone-900 text-white text-xs font-bold hover:bg-stone-800 cursor-pointer transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* MODAL 3: CREATE COMMERCIAL COUPON */}
        {/* ============================================================= */}
        {isCouponModalOpen && (
          <div className="fixed inset-0 bg-stone-950/50 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white/95 rounded-3xl border border-white/80 shadow-2xl p-6 sm:p-7 space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between pb-3 border-b border-stone-200/70">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900">Crear Cupón Comercial</h3>
                    <p className="text-[11px] text-stone-500">Campaña de descuentos gestionada por administración</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCouponModalOpen(false)}
                  disabled={isSubmittingCoupon}
                  className="p-1 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateCoupon} className="space-y-3.5">
                {/* Target Type Toggle */}
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1.5">
                    Tipo de Destinatario:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCouponForm({ ...couponForm, targetType: 'general', userId: '', maxUses: 100 })}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        couponForm.targetType === 'general'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Público General</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCouponForm({ ...couponForm, targetType: 'exclusive', maxUses: 1 })}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        couponForm.targetType === 'exclusive'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Exclusivo Cliente</span>
                    </button>
                  </div>
                </div>

                {/* Customer Selector for Exclusive Coupons */}
                {couponForm.targetType === 'exclusive' && (
                  <div>
                    <label className="text-xs font-bold text-stone-700 block mb-1">
                      Cliente Destinatario Registrado:
                    </label>
                    <select
                      required
                      value={couponForm.userId}
                      onChange={(e) => setCouponForm({ ...couponForm, userId: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    >
                      <option value="">-- Seleccionar Cliente Registrado --</option>
                      {customerOptions.map((cust) => (
                        <option key={cust.id} value={cust.id}>
                          {cust.name} ({cust.email})
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-stone-500 mt-0.5 block">
                      Solo este usuario podrá redimir el código iniciando sesión con su cuenta.
                    </span>
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Código de Cupón (Alfanumérico):
                  </label>
                  <input
                    type="text"
                    required
                    value={couponForm.code}
                    onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                    placeholder="Ej: BIENVENIDA20, AMORAMISTAD"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 font-mono text-xs uppercase text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                  <span className="text-[10px] text-stone-400 mt-0.5 block">
                    No puede iniciar con prefijos reservados de minijuego (MARIAI-, POMPON).
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-stone-700 block mb-1">
                      Descuento (%):
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      required
                      value={couponForm.discountPercent}
                      onChange={(e) => setCouponForm({ ...couponForm, discountPercent: parseInt(e.target.value, 10) || 10 })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-xs font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-700 block mb-1">
                      Límite de Usos:
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={99999}
                      required
                      value={couponForm.maxUses}
                      onChange={(e) => setCouponForm({ ...couponForm, maxUses: parseInt(e.target.value, 10) || 1 })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Fecha de Expiración (Opcional):
                  </label>
                  <input
                    type="date"
                    value={couponForm.expiresAt}
                    onChange={(e) => setCouponForm({ ...couponForm, expiresAt: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Descripción / Finalidad Comercial:
                  </label>
                  <input
                    type="text"
                    value={couponForm.description}
                    onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })}
                    placeholder="Ej: Descuento 15% por campaña del Día de la Madre"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>

                {couponModalError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{couponModalError}</span>
                  </div>
                )}

                {couponModalSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{couponModalSuccess}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCouponModalOpen(false)}
                    disabled={isSubmittingCoupon}
                    className="py-2 px-4 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-100 text-xs font-bold cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingCoupon}
                    className="py-2.5 px-5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSubmittingCoupon ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Guardando Cupón...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Crear Cupón</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
