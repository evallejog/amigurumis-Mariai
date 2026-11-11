import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from '../components/common/BrandLogo';
import { Product } from '../types';
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
  Minus,
  X,
  Menu,
  Calendar,
  History,
  ArrowRight,
  Check,
  Upload,
  Image as ImageIcon,
  Eye,
  EyeOff,
  Edit3,
  SlidersHorizontal,
  Ruler
} from 'lucide-react';

type AdminTab = 'overview' | 'products' | 'orders' | 'customers' | 'coupons' | 'btl' | 'analytics' | 'ml';

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
  totalProducts?: number;
  publishedProducts?: number;
  totalInventoryUnits?: number;
  inventoryValue?: number;
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

const ORDER_STATUS_LABELS: Record<string, string> = {
  pedido_recibido: 'Pedido recibido',
  en_preparacion: 'En preparación',
  enviado: 'Enviado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, token, isAuthenticated, isLoading: authLoading, logout, openAuthModal } = useAuth();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);

  // Lock body scroll and handle Escape key when mobile nav drawer is open
  useEffect(() => {
    if (!isMobileNavOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileNavOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileNavOpen]);

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

  // -----------------------------------------------------------------
  // PRODUCT MANAGEMENT STATE & HANDLERS (FASE 2F.5)
  // -----------------------------------------------------------------
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState<string>('');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('todos');
  const [productStatusFilter, setProductStatusFilter] = useState<string>('todos');
  const [productSort, setProductSort] = useState<string>('featured');
  const [productMetrics, setProductMetrics] = useState<{
    totalProducts: number;
    published: number;
    hidden: number;
    outOfStock: number;
    totalUnits: number;
    inventoryValue: number;
  } | null>(null);

  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);

  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    category: 'animales',
    price: 18500,
    stockUnits: 5,
    lowStockThreshold: 2,
    status: 'published' as 'published' | 'hidden' | 'out_of_stock',
    shortDescription: '',
    fullDescription: '',
    heightCm: 20,
    widthCm: 12,
    depthCm: 10,
    craftTimeHours: 6,
    difficulty: 'Intermedia',
    weaveType: 'Punto bajo en espiral continua',
    materials: 'Hilo 100% algodón rústico peinado, Vellón siliconado hipoalergénico, Ojos de seguridad',
    colors: 'Tostado, marfil',
    careInstructions: 'Lavar a mano con agua fría y secar horizontal a la sombra.',
    notes: '',
    imageUrl: '/src/assets/images/hero_amigurumi_showcase_1794329731742.jpg',
    featured: false,
  });

  const [isSubmittingProduct, setIsSubmittingProduct] = useState<boolean>(false);
  const [productModalError, setProductModalError] = useState<string | null>(null);
  const [productModalSuccess, setProductModalSuccess] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [quickActionId, setQuickActionId] = useState<string | null>(null);

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

  const loadProducts = async (
    search = productSearch,
    category = productCategoryFilter,
    status = productStatusFilter,
    sort = productSort
  ) => {
    try {
      setLoadingData(true);
      setErrorMessage(null);
      const query = new URLSearchParams({
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(category !== 'todos' ? { category } : {}),
        ...(status !== 'todos' ? { status } : {}),
        ...(sort ? { sort } : {}),
        limit: '100',
      });
      const res = await fetch(`/api/admin/products?${query.toString()}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Error al consultar productos del catálogo.');
      const data = await res.json();
      setProducts(data.products || []);
      setProductMetrics(data.metrics || null);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoadingData(false);
    }
  };

  const handleOpenCreateProduct = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      sku: '',
      category: 'animales',
      price: 18500,
      stockUnits: 5,
      lowStockThreshold: 2,
      status: 'published',
      shortDescription: '',
      fullDescription: '',
      heightCm: 20,
      widthCm: 12,
      depthCm: 10,
      craftTimeHours: 6,
      difficulty: 'Intermedia',
      weaveType: 'Punto bajo en espiral continua',
      materials: 'Hilo 100% algodón rústico peinado, Vellón siliconado hipoalergénico, Ojos de seguridad',
      colors: '',
      careInstructions: 'Lavar a mano con agua fría y secar horizontal a la sombra.',
      notes: '',
      imageUrl: '/src/assets/images/hero_amigurumi_showcase_1794329731742.jpg',
      featured: false,
    });
    setProductModalError(null);
    setProductModalSuccess(null);
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setProductForm({
      name: prod.name,
      sku: prod.sku || '',
      category: prod.category || 'animales',
      price: prod.price,
      stockUnits: prod.stockUnits ?? 0,
      lowStockThreshold: prod.lowStockThreshold ?? 3,
      status: (prod.status as any) || 'published',
      shortDescription: prod.shortDescription || '',
      fullDescription: prod.fullDescription || '',
      heightCm: prod.dimensions?.heightCm || 20,
      widthCm: prod.dimensions?.widthCm || 12,
      depthCm: prod.dimensions?.depthCm || 10,
      craftTimeHours: prod.approxCraftTimeHours || 6,
      difficulty: prod.difficulty || 'Intermedia',
      weaveType: prod.weaveType || 'Punto bajo en espiral continua',
      materials: Array.isArray(prod.materials) ? prod.materials.join(', ') : (prod.materials || ''),
      colors: prod.colors || '',
      careInstructions: prod.careInstructions || '',
      notes: prod.notes || '',
      imageUrl: prod.imageUrl || '',
      featured: Boolean(prod.featured),
    });
    setProductModalError(null);
    setProductModalSuccess(null);
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) {
      setProductModalError('El nombre del amigurumi es obligatorio.');
      return;
    }
    if (productForm.price <= 0) {
      setProductModalError('El precio debe ser mayor a 0 COP.');
      return;
    }
    if (productForm.stockUnits < 0) {
      setProductModalError('El inventario no puede ser negativo.');
      return;
    }

    try {
      setIsSubmittingProduct(true);
      setProductModalError(null);
      setProductModalSuccess(null);

      const materialsArray = productForm.materials
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean);

      const payload = {
        name: productForm.name.trim(),
        sku: productForm.sku.trim() || undefined,
        category: productForm.category,
        price: Number(productForm.price),
        stockUnits: Number(productForm.stockUnits),
        lowStockThreshold: Number(productForm.lowStockThreshold),
        status: productForm.status,
        shortDescription: productForm.shortDescription.trim(),
        fullDescription: productForm.fullDescription.trim(),
        heightCm: productForm.heightCm ? Number(productForm.heightCm) : undefined,
        widthCm: productForm.widthCm ? Number(productForm.widthCm) : undefined,
        depthCm: productForm.depthCm ? Number(productForm.depthCm) : undefined,
        craftTimeHours: Number(productForm.craftTimeHours),
        difficulty: productForm.difficulty,
        weaveType: productForm.weaveType,
        materials: materialsArray,
        colors: productForm.colors.trim(),
        careInstructions: productForm.careInstructions.trim(),
        notes: productForm.notes.trim(),
        imageUrl: productForm.imageUrl.trim(),
        featured: productForm.featured,
      };

      const isEdit = Boolean(editingProduct);
      const url = isEdit ? `/api/admin/products/${editingProduct!.id}` : '/api/admin/products';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al guardar el amigurumi.');
      }

      setProductModalSuccess(data.message || 'Producto guardado exitosamente.');
      window.dispatchEvent(new Event('catalog_updated'));
      setTimeout(() => {
        setIsProductModalOpen(false);
        loadProducts();
        loadOverview();
      }, 1000);
    } catch (err: any) {
      setProductModalError(err.message);
    } finally {
      setIsSubmittingProduct(false);
    }
  };

  const handleQuickStockChange = async (prodId: string, currentStock: number, delta: number) => {
    const newStock = Math.max(0, currentStock + delta);
    try {
      setQuickActionId(prodId);
      const res = await fetch(`/api/admin/products/${prodId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ stockUnits: newStock }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al actualizar inventario.');
      }
      setProducts((prev) =>
        prev.map((p) =>
          p.id === prodId
            ? {
                ...p,
                stockUnits: newStock,
                availability: newStock === 0 ? 'out_of_stock' : newStock <= (p.lowStockThreshold || 3) ? 'low_stock' : 'in_stock',
                status: newStock === 0 ? 'out_of_stock' : (p.status === 'out_of_stock' ? 'published' : p.status),
              }
            : p
        )
      );
      window.dispatchEvent(new Event('catalog_updated'));
      loadOverview();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message);
    } finally {
      setQuickActionId(null);
    }
  };

  const handleToggleProductStatus = async (prodId: string, currentStatus?: string) => {
    const nextStatus = currentStatus === 'published' ? 'hidden' : 'published';
    try {
      setQuickActionId(prodId);
      const res = await fetch(`/api/admin/products/${prodId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al cambiar estado.');
      }
      const data = await res.json();
      setProducts((prev) =>
        prev.map((p) => (p.id === prodId ? { ...p, status: data.product.status, availability: data.product.availability } : p))
      );
      window.dispatchEvent(new Event('catalog_updated'));
      loadOverview();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message);
    } finally {
      setQuickActionId(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setProductModalError('Solo se permiten imágenes JPEG, PNG o WebP.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setProductModalError('La imagen no debe superar los 5 MB.');
      return;
    }

    try {
      setIsUploadingImage(true);
      setProductModalError(null);

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const res = await fetch('/api/admin/products/upload-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders(),
            },
            body: JSON.stringify({
              fileData: base64,
              fileName: file.name,
              mimeType: file.type,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || 'Error al subir imagen.');
          }
          setProductForm((prev) => ({ ...prev, imageUrl: data.url }));
        } catch (err: any) {
          setProductModalError(err.message);
        } finally {
          setIsUploadingImage(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setProductModalError(err.message);
      setIsUploadingImage(false);
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
    else if (activeTab === 'products') loadProducts();
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
    { id: 'products', label: 'Catálogo de Amigurumis', icon: Package, badge: overview?.totalProducts?.toString() },
    { id: 'orders', label: 'Gestión de Pedidos', icon: ShoppingBag, badge: overview?.totalOrders?.toString() },
    { id: 'customers', label: 'Clientes Registrados', icon: Users, badge: overview?.totalCustomers?.toString() },
    { id: 'coupons', label: 'Cupones & Recompensas', icon: Tag, badge: overview?.totalCoupons?.toString() },
    { id: 'btl', label: 'Videojuego Pompón', icon: Gamepad2 },
    { id: 'analytics', label: 'Data Analytics', icon: BarChart3, badge: 'Fase 3' },
    { id: 'ml', label: 'Machine Learning', icon: Cpu, badge: 'Fase 4' },
  ];

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#2E2823] font-sans flex flex-col lg:flex-row">
      {/* MOBILE TOP BAR (lg:hidden) */}
      <header className="lg:hidden sticky top-0 z-30 bg-white/95 border-b border-stone-200/80 px-4 py-3 flex items-center justify-between backdrop-blur-md shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileNavOpen(true)}
            aria-label="Abrir menú de navegación"
            className="p-2 -ml-1 text-stone-700 hover:text-stone-950 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <BrandLogo size="sm" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-950 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-300/60 font-sans">
              Admin
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (activeTab === 'overview') loadOverview();
              else if (activeTab === 'products') loadProducts();
              else if (activeTab === 'orders') loadOrders();
              else if (activeTab === 'customers') loadCustomers();
              else if (activeTab === 'coupons') loadCoupons();
              else if (activeTab === 'btl') loadBtl();
            }}
            disabled={loadingData}
            aria-label="Actualizar datos"
            className="p-2 text-stone-600 hover:text-stone-950 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-amber-700 ${loadingData ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => navigate('/')}
            className="text-xs font-bold text-stone-600 hover:text-stone-900 px-2.5 py-1.5 rounded-xl border border-stone-200 bg-stone-50 transition-colors"
          >
            Tienda
          </button>
        </div>
      </header>

      {/* MOBILE DRAWER NAVIGATION (Smooth CSS Transition 300ms) */}
      <div
        className={`fixed inset-0 z-50 lg:hidden transition-all duration-300 ${
          isMobileNavOpen ? 'visible pointer-events-auto' : 'invisible pointer-events-none'
        }`}
        aria-hidden={!isMobileNavOpen}
      >
        {/* Backdrop with fade transition */}
        <div
          className={`fixed inset-0 bg-stone-900/60 backdrop-blur-xs transition-opacity duration-300 ease-out ${
            isMobileNavOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setIsMobileNavOpen(false)}
          aria-hidden="true"
        />

        {/* Drawer Sheet with slide transition & accessibility */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menú de navegación del panel administrativo"
          className={`fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white p-5 shadow-2xl flex flex-col justify-between overflow-y-auto z-50 transition-transform duration-300 ease-out motion-reduce:transition-none ${
            isMobileNavOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div>
            {/* Header inside drawer */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-stone-200/60">
              <div>
                <BrandLogo size="sm" />
                <div className="flex items-center gap-1.5 mt-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-950 font-sans">
                    Panel Administrativo
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(false)}
                aria-label="Cerrar menú"
                className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Links */}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer ${
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

          {/* User Footer inside drawer */}
          <div className="pt-4 border-t border-stone-200/60 space-y-2 mt-6">
            <div className="p-2.5 rounded-xl bg-stone-100/80 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-900 truncate max-w-[120px]">{user?.fullName}</span>
                <span className="px-1.5 py-0.5 rounded-md bg-amber-200/80 text-amber-950 font-extrabold text-[9px]">
                  ADMIN
                </span>
              </div>
              <p className="text-[10px] text-stone-500 truncate mt-0.5">{user?.email}</p>
            </div>

            <button
              onClick={() => {
                setIsMobileNavOpen(false);
                navigate('/');
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-stone-200 text-stone-700 hover:text-stone-950 hover:bg-white text-xs font-bold transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-stone-500" />
              <span>Volver a la Tienda</span>
            </button>

            <button
              onClick={() => {
                setIsMobileNavOpen(false);
                logout();
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </div>

      {/* SIDEBAR NAVIGATION (DESKTOP) */}
      <aside className="hidden lg:flex lg:w-64 bg-white/85 border-r border-stone-200/80 p-6 flex-col justify-between shrink-0 backdrop-blur-2xl sticky top-0 h-screen overflow-y-auto">
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
        <div className="pt-4 border-t border-stone-200/60 space-y-2 mt-6">
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
              {activeTab === 'products' && 'Gestión del Catálogo de Amigurumis'}
              {activeTab === 'orders' && 'Gestión de Pedidos & Despachos'}
              {activeTab === 'customers' && 'Directorio de Clientes'}
              {activeTab === 'coupons' && 'Cupones & Recompensas'}
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
                else if (activeTab === 'products') loadProducts();
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
                    Partidas Pompón & Cupones
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
                            <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap shrink-0 border ${
                              ord.status === 'entregado'
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : ord.status === 'enviado'
                                ? 'bg-blue-100 text-blue-900 border-blue-300'
                                : ord.status === 'en_preparacion'
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-stone-200 text-stone-800 border-stone-300'
                            }`}>
                              {ORDER_STATUS_LABELS[ord.status] || ord.status.replace('_', ' ')}
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
        {/* TAB: PRODUCTS CATALOG MANAGEMENT (FASE 2F.5) */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            {/* Inventory & Catalog KPI Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-4 rounded-2xl liquid-glass border border-white/80 shadow-xs bg-white/75">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block mb-1">
                  Total Amigurumis
                </span>
                <div className="text-xl font-black text-stone-900 font-sans">
                  {productMetrics?.totalProducts ?? products.length}
                </div>
                <p className="text-[10px] text-stone-500 mt-0.5">En base SQLite</p>
              </div>

              <div className="p-4 rounded-2xl liquid-glass border border-white/80 shadow-xs bg-white/75">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
                  Publicados
                </span>
                <div className="text-xl font-black text-emerald-950 font-sans">
                  {productMetrics?.published ?? products.filter((p) => p.status === 'published').length}
                </div>
                <p className="text-[10px] text-emerald-600 mt-0.5">Visibles en tienda</p>
              </div>

              <div className="p-4 rounded-2xl liquid-glass border border-white/80 shadow-xs bg-white/75">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-600 block mb-1">
                  Ocultos
                </span>
                <div className="text-xl font-black text-stone-800 font-sans">
                  {productMetrics?.hidden ?? products.filter((p) => p.status === 'hidden').length}
                </div>
                <p className="text-[10px] text-stone-500 mt-0.5">En taller / catálogo privado</p>
              </div>

              <div className="p-4 rounded-2xl liquid-glass border border-white/80 shadow-xs bg-white/75">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block mb-1">
                  Agotados
                </span>
                <div className="text-xl font-black text-rose-950 font-sans">
                  {productMetrics?.outOfStock ?? products.filter((p) => p.status === 'out_of_stock' || (p.stockUnits || 0) <= 0).length}
                </div>
                <p className="text-[10px] text-rose-600 mt-0.5">Sin stock disponible</p>
              </div>

              <div className="p-4 rounded-2xl liquid-glass border border-white/80 shadow-xs bg-white/75">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block mb-1">
                  Stock en Taller
                </span>
                <div className="text-xl font-black text-amber-950 font-sans">
                  {productMetrics?.totalUnits ?? products.reduce((acc, p) => acc + (p.stockUnits || 0), 0)}
                </div>
                <p className="text-[10px] text-amber-800 mt-0.5">Unidades tejidas</p>
              </div>

              <div className="p-4 rounded-2xl liquid-glass border border-white/80 shadow-xs bg-white/75">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block mb-1">
                  Valor Inventario
                </span>
                <div className="text-sm font-black text-indigo-950 font-sans truncate" title={formatCOP(productMetrics?.inventoryValue ?? 0)}>
                  {formatCOP(productMetrics?.inventoryValue ?? 0)}
                </div>
                <p className="text-[10px] text-indigo-600 mt-0.5">Valor artesanal COP</p>
              </div>
            </div>

            {/* Filter Toolbar & Add Product CTA */}
            <div className="p-4 sm:p-5 rounded-3xl liquid-glass border border-white/80 shadow-xs bg-white/80 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-stone-900 font-sans flex items-center gap-2">
                    <Package className="w-4 h-4 text-amber-700" />
                    <span>Catálogo Maestro de Amigurumis</span>
                  </h3>
                  <p className="text-xs text-stone-500">
                    Control de fichas técnicas artesanales, precios, inventario en tiempo real y visibilidad en tienda
                  </p>
                </div>

                <button
                  onClick={handleOpenCreateProduct}
                  className="py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer transition-all shadow-md flex items-center justify-center gap-2 self-start md:self-auto shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nuevo Amigurumi</span>
                </button>
              </div>

              {/* Filter controls */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-3 border-t border-stone-200/60">
                {/* Search */}
                <div className="sm:col-span-4 relative">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        loadProducts(productSearch, productCategoryFilter, productStatusFilter, productSort);
                      }
                    }}
                    placeholder="Buscar por nombre, SKU o etiqueta..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/90 border border-stone-200 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>

                {/* Category */}
                <div className="sm:col-span-3">
                  <select
                    value={productCategoryFilter}
                    onChange={(e) => {
                      const val = e.target.value;
                      setProductCategoryFilter(val);
                      loadProducts(productSearch, val, productStatusFilter, productSort);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-white/90 border border-stone-200 text-xs text-stone-800 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  >
                    <option value="todos">Todas las Categorías</option>
                    <option value="animales">Animales</option>
                    <option value="fantasia">Fantasía</option>
                    <option value="festivos">Festivos & Ocasiones</option>
                    <option value="accesorios">Accesorios</option>
                  </select>
                </div>

                {/* Status */}
                <div className="sm:col-span-2">
                  <select
                    value={productStatusFilter}
                    onChange={(e) => {
                      const val = e.target.value;
                      setProductStatusFilter(val);
                      loadProducts(productSearch, productCategoryFilter, val, productSort);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-white/90 border border-stone-200 text-xs text-stone-800 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  >
                    <option value="todos">Todos los Estados</option>
                    <option value="published">Publicados</option>
                    <option value="hidden">Ocultos</option>
                    <option value="out_of_stock">Agotados</option>
                  </select>
                </div>

                {/* Sort */}
                <div className="sm:col-span-2">
                  <select
                    value={productSort}
                    onChange={(e) => {
                      const val = e.target.value;
                      setProductSort(val);
                      loadProducts(productSearch, productCategoryFilter, productStatusFilter, val);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-white/90 border border-stone-200 text-xs text-stone-800 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  >
                    <option value="featured">Destacados primero</option>
                    <option value="price_asc">Precio: Menor a Mayor</option>
                    <option value="price_desc">Precio: Mayor a Menor</option>
                    <option value="stock_asc">Stock: Menor primero</option>
                    <option value="name_asc">Nombre: A-Z</option>
                  </select>
                </div>

                {/* Action buttons */}
                <div className="sm:col-span-1 flex items-center gap-1.5">
                  <button
                    onClick={() => loadProducts(productSearch, productCategoryFilter, productStatusFilter, productSort)}
                    className="w-full py-2 px-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer transition-colors shadow-xs flex items-center justify-center"
                    title="Buscar"
                  >
                    <Search className="w-3.5 h-3.5" />
                  </button>
                  {(productSearch || productCategoryFilter !== 'todos' || productStatusFilter !== 'todos') && (
                    <button
                      onClick={() => {
                        setProductSearch('');
                        setProductCategoryFilter('todos');
                        setProductStatusFilter('todos');
                        setProductSort('featured');
                        loadProducts('', 'todos', 'todos', 'featured');
                      }}
                      className="py-2 px-2.5 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-700 font-bold text-xs cursor-pointer transition-colors"
                      title="Restablecer filtros"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Products Table (Desktop) */}
            <div className="hidden md:block p-5 rounded-3xl liquid-glass border border-white/80 shadow-xs bg-white/80 overflow-hidden">
              {products.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <Package className="w-10 h-10 text-stone-300 mx-auto" />
                  <p className="text-sm font-bold text-stone-700">No se encontraron amigurumis con los filtros seleccionados.</p>
                  <p className="text-xs text-stone-400">Intenta cambiar los términos de búsqueda o crear una nueva pieza.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[800px]">
                    <thead>
                      <tr className="border-b border-stone-200/80 text-stone-500 font-bold uppercase tracking-wider text-[10px]">
                        <th className="pb-3 pl-2">Amigurumi</th>
                        <th className="pb-3">Categoría & Dificultad</th>
                        <th className="pb-3">Dimensiones</th>
                        <th className="pb-3">Precio (COP)</th>
                        <th className="pb-3 text-center">Inventario Taller</th>
                        <th className="pb-3 text-center">Estado Comercial</th>
                        <th className="pb-3 text-right pr-2">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {products.map((prod) => {
                        const isLowStock = (prod.stockUnits || 0) <= (prod.lowStockThreshold || 3) && (prod.stockUnits || 0) > 0;
                        const isOutOfStock = (prod.stockUnits || 0) <= 0 || prod.status === 'out_of_stock';
                        const isBusy = quickActionId === prod.id;

                        return (
                          <tr key={prod.id} className="hover:bg-amber-50/40 transition-colors">
                            {/* Product Thumbnail & Title */}
                            <td className="py-3 pl-2">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl overflow-hidden bg-stone-100 border border-stone-200/70 shrink-0">
                                  <img
                                    src={prod.imageUrl || '/src/assets/images/hero_amigurumi_showcase_1794329731742.jpg'}
                                    alt={prod.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-stone-900 line-clamp-1">{prod.name}</span>
                                    {prod.featured && (
                                      <span className="px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-900 text-[9px] font-extrabold uppercase">
                                        Destacado
                                      </span>
                                    )}
                                  </div>
                                  <span className="font-mono text-[10px] text-stone-400 block mt-0.5">
                                    SKU: {prod.sku || 'N/A'}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Category & Difficulty */}
                            <td className="py-3">
                              <div className="space-y-0.5">
                                <span className="capitalize font-semibold text-stone-700 block text-[11px]">
                                  {prod.category}
                                </span>
                                <span className="text-[10px] text-stone-500 flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-amber-700" />
                                  {prod.approxCraftTimeHours || 5}h &bull; {prod.difficulty || 'Intermedia'}
                                </span>
                              </div>
                            </td>

                            {/* Dimensions */}
                            <td className="py-3 text-stone-600 font-mono text-[11px]">
                              {prod.dimensions ? (
                                <span>
                                  {prod.dimensions.heightCm}h &times; {prod.dimensions.widthCm}w
                                  {prod.dimensions.depthCm ? ` &times; ${prod.dimensions.depthCm}d` : ''} cm
                                </span>
                              ) : (
                                <span className="text-stone-400">20 &times; 12 cm</span>
                              )}
                            </td>

                            {/* Price */}
                            <td className="py-3 font-bold text-stone-900 font-sans text-xs">
                              {formatCOP(prod.price)}
                            </td>

                            {/* Inventory with Quick Stepper */}
                            <td className="py-3 text-center">
                              <div className="inline-flex items-center gap-1.5 bg-stone-100/90 p-1 rounded-xl border border-stone-200">
                                <button
                                  onClick={() => handleQuickStockChange(prod.id, prod.stockUnits || 0, -1)}
                                  disabled={(prod.stockUnits || 0) <= 0 || isBusy}
                                  className="w-6 h-6 rounded-lg bg-white text-stone-700 hover:bg-stone-200/80 disabled:opacity-40 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                                  title="Reducir inventario en 1"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className={`w-8 text-center font-bold text-xs ${
                                  isOutOfStock
                                    ? 'text-rose-600'
                                    : isLowStock
                                    ? 'text-amber-700'
                                    : 'text-stone-900'
                                }`}>
                                  {prod.stockUnits ?? 0}
                                </span>
                                <button
                                  onClick={() => handleQuickStockChange(prod.id, prod.stockUnits || 0, 1)}
                                  disabled={isBusy}
                                  className="w-6 h-6 rounded-lg bg-white text-stone-700 hover:bg-stone-200/80 disabled:opacity-40 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                                  title="Incrementar inventario en 1"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                              <div className="mt-1">
                                {isOutOfStock ? (
                                  <span className="text-[9px] font-bold text-rose-700 uppercase">Sin Stock</span>
                                ) : isLowStock ? (
                                  <span className="text-[9px] font-bold text-amber-700 uppercase">Bajo Stock</span>
                                ) : (
                                  <span className="text-[9px] font-semibold text-emerald-700">En Taller</span>
                                )}
                              </div>
                            </td>

                            {/* Commercial Status & Quick Toggle */}
                            <td className="py-3 text-center">
                              <button
                                onClick={() => handleToggleProductStatus(prod.id, prod.status)}
                                disabled={isBusy}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer shadow-2xs ${
                                  prod.status === 'published'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                    : prod.status === 'out_of_stock'
                                    ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                                    : 'bg-stone-100 text-stone-700 border-stone-300 hover:bg-stone-200'
                                }`}
                                title="Haz clic para alternar visibilidad pública / oculta"
                              >
                                {prod.status === 'published' ? (
                                  <>
                                    <Eye className="w-3 h-3 text-emerald-600" />
                                    <span>Publicado</span>
                                  </>
                                ) : prod.status === 'out_of_stock' ? (
                                  <>
                                    <AlertCircle className="w-3 h-3 text-rose-600" />
                                    <span>Agotado</span>
                                  </>
                                ) : (
                                  <>
                                    <EyeOff className="w-3 h-3 text-stone-500" />
                                    <span>Oculto</span>
                                  </>
                                )}
                              </button>
                            </td>

                            {/* Actions */}
                            <td className="py-3 pr-2 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setDetailProduct(prod);
                                    setIsDetailModalOpen(true);
                                  }}
                                  className="py-1.5 px-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1"
                                  title="Ver Ficha Técnica Artesanal"
                                >
                                  <FileText className="w-3 h-3 text-stone-500" />
                                  <span>Ficha</span>
                                </button>
                                <button
                                  onClick={() => handleOpenEditProduct(prod)}
                                  className="py-1.5 px-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                                  title="Editar Amigurumi"
                                >
                                  <Edit3 className="w-3 h-3 text-amber-700" />
                                  <span>Editar</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Products Cards (Mobile) */}
            <div className="md:hidden space-y-3">
              {products.length === 0 ? (
                <div className="text-center py-8 p-4 rounded-2xl bg-white border border-stone-200 space-y-2">
                  <Package className="w-8 h-8 text-stone-300 mx-auto" />
                  <p className="text-xs font-bold text-stone-700">No se encontraron amigurumis.</p>
                </div>
              ) : (
                products.map((prod) => {
                  const isLowStock = (prod.stockUnits || 0) <= (prod.lowStockThreshold || 3) && (prod.stockUnits || 0) > 0;
                  const isOutOfStock = (prod.stockUnits || 0) <= 0 || prod.status === 'out_of_stock';
                  const isBusy = quickActionId === prod.id;

                  return (
                    <div key={prod.id} className="p-4 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-14 h-14 rounded-xl overflow-hidden bg-stone-100 border border-stone-200 shrink-0">
                          <img
                            src={prod.imageUrl || '/src/assets/images/hero_amigurumi_showcase_1794329731742.jpg'}
                            alt={prod.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className="font-bold text-xs text-stone-900 truncate">{prod.name}</h4>
                            {prod.featured && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 text-[9px] font-bold shrink-0">
                                Destacado
                              </span>
                            )}
                          </div>
                          <p className="font-mono text-[10px] text-stone-400 mt-0.5">SKU: {prod.sku || 'N/A'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-black text-amber-950 text-xs">{formatCOP(prod.price)}</span>
                            <span className="text-[10px] text-stone-500 font-medium capitalize">&bull; {prod.category}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-stone-100 gap-2">
                        {/* Stock Stepper */}
                        <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl">
                          <button
                            onClick={() => handleQuickStockChange(prod.id, prod.stockUnits || 0, -1)}
                            disabled={(prod.stockUnits || 0) <= 0 || isBusy}
                            className="w-6 h-6 rounded-lg bg-white text-stone-700 disabled:opacity-40 flex items-center justify-center cursor-pointer shadow-2xs"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center font-bold text-xs text-stone-900">
                            {prod.stockUnits ?? 0}
                          </span>
                          <button
                            onClick={() => handleQuickStockChange(prod.id, prod.stockUnits || 0, 1)}
                            disabled={isBusy}
                            className="w-6 h-6 rounded-lg bg-white text-stone-700 disabled:opacity-40 flex items-center justify-center cursor-pointer shadow-2xs"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Status Toggle */}
                        <button
                          onClick={() => handleToggleProductStatus(prod.id, prod.status)}
                          disabled={isBusy}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                            prod.status === 'published'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-stone-100 text-stone-700 border-stone-300'
                          }`}
                        >
                          {prod.status === 'published' ? 'Publicado' : 'Oculto'}
                        </button>

                        {/* Detail & Edit */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setDetailProduct(prod);
                              setIsDetailModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-stone-100 text-stone-700 hover:bg-stone-200 cursor-pointer"
                            title="Ficha Técnica"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEditProduct(prod)}
                            className="p-1.5 rounded-lg bg-amber-500/10 text-amber-900 hover:bg-amber-500/20 cursor-pointer font-bold text-xs"
                            title="Editar"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
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
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                        orderStatusFilter === st
                          ? 'bg-stone-900 text-white shadow-xs'
                          : 'bg-stone-200/70 text-stone-700 hover:bg-stone-300/60'
                      }`}
                    >
                      {st === 'todos' ? 'Todos los estados' : ORDER_STATUS_LABELS[st] || st.replace('_', ' ')}
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
                                {ORDER_STATUS_LABELS[ord.status] || ord.status.replace('_', ' ')}
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
                <h3 className="text-sm font-bold text-stone-900">Gestión de Cupones Comerciales & Recompensas de Pompón</h3>
                <p className="text-xs text-stone-500">
                  Las recompensas de juego derivan de la superación de niveles en el minijuego de Pompón. Los cupones comerciales son creados por la administración.
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
                    { id: 'btl', label: 'Recompensas de Juego' },
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
                                  Recompensa de Pompón
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
                    Recompensas Otorgadas
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
                  Agregación diaria y semanal de pedidos confirmados versus canje de recompensas de Pompón.
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
                  Clasificación de anomalías para identificar reclamos automáticos de recompensas de Pompón sin jugabilidad humana.
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

        {/* ============================================================= */}
        {/* MODAL 5: PRODUCT CREATE & EDIT MODAL (FASE 2F.5) */}
        {/* ============================================================= */}
        {isProductModalOpen && (
          <div className="fixed inset-0 bg-stone-950/60 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="w-full max-w-3xl bg-white/95 rounded-3xl border border-white/80 shadow-2xl p-6 sm:p-7 space-y-5 animate-fadeIn my-6 max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-stone-200/70 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                    <Package className="w-5 h-5 text-amber-700" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-stone-900 font-sans">
                      {editingProduct ? `Editar: ${editingProduct.name}` : 'Nuevo Amigurumi Artesanal'}
                    </h3>
                    <p className="text-[11px] text-stone-500">
                      {editingProduct
                        ? `Modificando registro SKU ${editingProduct.sku || editingProduct.id}`
                        : 'Registro maestro de pieza tejida a mano con persistencia en SQLite'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsProductModalOpen(false)}
                  disabled={isSubmittingProduct}
                  className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Form Body (Scrollable) */}
              <form onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto pr-1 space-y-5">
                {/* Error & Success Alerts */}
                {productModalError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{productModalError}</span>
                  </div>
                )}
                {productModalSuccess && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{productModalSuccess}</span>
                  </div>
                )}

                {/* Section 1: General Info */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                    <span>1. Identificación & Categoría</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-6">
                      <label className="text-xs font-bold text-stone-700 block mb-1">
                        Nombre de la Pieza <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={productForm.name}
                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                        placeholder="Ej: Osito Meloso de Algodón"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="text-xs font-bold text-stone-700 block mb-1">
                        SKU Comercial
                      </label>
                      <input
                        type="text"
                        value={productForm.sku}
                        onChange={(e) => setProductForm({ ...productForm, sku: e.target.value.toUpperCase() })}
                        placeholder="Ej: AMI-009"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-xs font-mono uppercase text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="text-xs font-bold text-stone-700 block mb-1">
                        Categoría
                      </label>
                      <select
                        value={productForm.category}
                        onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                      >
                        <option value="animales">Animales</option>
                        <option value="fantasia">Fantasía</option>
                        <option value="festivos">Festivos & Ocasiones</option>
                        <option value="accesorios">Accesorios</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 2: Pricing & Stock */}
                <div className="space-y-3 pt-2 border-t border-stone-200/60">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-700" />
                    <span>2. Valores Comerciales & Stock en Taller</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs font-bold text-stone-700 block mb-1">
                        Precio COP <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        min={1000}
                        step={500}
                        value={productForm.price}
                        onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) || 0 })}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-xs font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                      />
                      <span className="text-[10px] text-stone-500 mt-0.5 block">{formatCOP(productForm.price)}</span>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-stone-700 block mb-1">
                        Inventario Físico (Unidades) <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        min={0}
                        value={productForm.stockUnits}
                        onChange={(e) => setProductForm({ ...productForm, stockUnits: Number(e.target.value) || 0 })}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-xs font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-stone-700 block mb-1">
                        Umbral Alerta Bajo Stock
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={productForm.lowStockThreshold}
                        onChange={(e) => setProductForm({ ...productForm, lowStockThreshold: Number(e.target.value) || 2 })}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-stone-700 block mb-1">
                        Estado de Publicación
                      </label>
                      <select
                        value={productForm.status}
                        onChange={(e) => setProductForm({ ...productForm, status: e.target.value as any })}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-xs font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                      >
                        <option value="published">Publicado (Visible en tienda)</option>
                        <option value="hidden">Oculto (Borrador interno)</option>
                        <option value="out_of_stock">Agotado (Sin unidades)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="product-featured-cb"
                      checked={productForm.featured}
                      onChange={(e) => setProductForm({ ...productForm, featured: e.target.checked })}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-stone-300"
                    />
                    <label htmlFor="product-featured-cb" className="text-xs font-semibold text-stone-700 cursor-pointer">
                      Destacar este amigurumi en la cabecera de la vitrina principal
                    </label>
                  </div>
                </div>

                {/* Section 3: Descriptions */}
                <div className="space-y-3 pt-2 border-t border-stone-200/60">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-700" />
                    <span>3. Reseñas & Contenido Comercial</span>
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-stone-700 block mb-1">
                        Descripción Corta (Tarjeta de catálogo):
                      </label>
                      <input
                        type="text"
                        value={productForm.shortDescription}
                        onChange={(e) => setProductForm({ ...productForm, shortDescription: e.target.value })}
                        placeholder="Ej: Tierno oso tejido a mano en hilo de algodón rústico color miel."
                        className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-stone-700 block mb-1">
                        Descripción Completa / Historia de la Pieza:
                      </label>
                      <textarea
                        rows={3}
                        value={productForm.fullDescription}
                        onChange={(e) => setProductForm({ ...productForm, fullDescription: e.target.value })}
                        placeholder="Detalla la inspiración artesanal, acabados y textura de la pieza..."
                        className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 4: Artisanal Metrics & Craftsmanship */}
                <div className="space-y-3 pt-2 border-t border-stone-200/60">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                    <Ruler className="w-3.5 h-3.5 text-amber-700" />
                    <span>4. Ficha Técnica de Confección Artesanal</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                    <div>
                      <label className="text-xs font-bold text-stone-700 block mb-1">
                        Alto (cm)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={productForm.heightCm}
                        onChange={(e) => setProductForm({ ...productForm, heightCm: Number(e.target.value) || 0 })}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-stone-700 block mb-1">
                        Ancho (cm)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={productForm.widthCm}
                        onChange={(e) => setProductForm({ ...productForm, widthCm: Number(e.target.value) || 0 })}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-stone-700 block mb-1">
                        Profundidad (cm)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={productForm.depthCm}
                        onChange={(e) => setProductForm({ ...productForm, depthCm: Number(e.target.value) || 0 })}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-stone-700 block mb-1">
                        Horas de Tejido
                      </label>
                      <input
                        type="number"
                        min={0.5}
                        step={0.5}
                        value={productForm.craftTimeHours}
                        onChange={(e) => setProductForm({ ...productForm, craftTimeHours: Number(e.target.value) || 0 })}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-stone-700 block mb-1">
                        Dificultad
                      </label>
                      <select
                        value={productForm.difficulty}
                        onChange={(e) => setProductForm({ ...productForm, difficulty: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                      >
                        <option value="Básica">Básica</option>
                        <option value="Fácil">Fácil</option>
                        <option value="Intermedia">Intermedia</option>
                        <option value="Avanzada">Avanzada</option>
                        <option value="Experta">Experta</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-stone-700 block mb-1">
                        Técnica
                      </label>
                      <input
                        type="text"
                        value={productForm.weaveType}
                        onChange={(e) => setProductForm({ ...productForm, weaveType: e.target.value })}
                        placeholder="Punto bajo en espiral"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 5: Materials & Care */}
                <div className="space-y-3 pt-2 border-t border-stone-200/60">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                    <span>5. Materiales, Insumos & Preservación</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-stone-700 block mb-1">
                        Materiales e Insumos (Separados por coma):
                      </label>
                      <input
                        type="text"
                        value={productForm.materials}
                        onChange={(e) => setProductForm({ ...productForm, materials: e.target.value })}
                        placeholder="Hilo 100% algodón, Vellón siliconado, Ojos de seguridad"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-stone-700 block mb-1">
                        Paleta de Colores:
                      </label>
                      <input
                        type="text"
                        value={productForm.colors}
                        onChange={(e) => setProductForm({ ...productForm, colors: e.target.value })}
                        placeholder="Ej: Miel, marfil, café chocolate"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-xs font-bold text-stone-700 block mb-1">
                        Recomendaciones de Cuidado:
                      </label>
                      <input
                        type="text"
                        value={productForm.careInstructions}
                        onChange={(e) => setProductForm({ ...productForm, careInstructions: e.target.value })}
                        placeholder="Ej: Lavar a mano con agua fría y jabón suave. Secar horizontal a la sombra."
                        className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 6: Image Management */}
                <div className="space-y-3 pt-2 border-t border-stone-200/60">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-amber-700" />
                    <span>6. Fotografía Principal del Amigurumi</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                    {/* Thumbnail preview */}
                    <div className="sm:col-span-3">
                      <div className="w-full aspect-square rounded-2xl overflow-hidden bg-stone-100 border border-stone-200 shadow-inner flex items-center justify-center relative">
                        {productForm.imageUrl ? (
                          <img
                            src={productForm.imageUrl}
                            alt="Vista previa"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="text-stone-400 text-center p-3">
                            <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-50" />
                            <span className="text-[10px]">Sin imagen</span>
                          </div>
                        )}
                        {isUploadingImage && (
                          <div className="absolute inset-0 bg-stone-900/60 flex flex-col items-center justify-center text-white">
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mb-1" />
                            <span className="text-[10px] font-bold">Subiendo...</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Upload Controls */}
                    <div className="sm:col-span-9 space-y-3">
                      <div>
                        <label className="text-xs font-bold text-stone-700 block mb-1">
                          Cargar Archivo Local (JPEG, PNG o WebP, máx 5MB):
                        </label>
                        <div className="flex items-center gap-2">
                          <label className="py-2 px-3.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold cursor-pointer transition-colors border border-stone-200/80 flex items-center gap-2 shadow-2xs">
                            <Upload className="w-4 h-4 text-amber-700" />
                            <span>Seleccionar Fotografía</span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={handleFileUpload}
                              disabled={isUploadingImage}
                              className="hidden"
                            />
                          </label>
                          <span className="text-[11px] text-stone-500">
                            {isUploadingImage ? 'Procesando en servidor...' : 'Almacenamiento seguro en taller'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-stone-700 block mb-1">
                          O especifica una ruta/URL de imagen directa:
                        </label>
                        <input
                          type="text"
                          value={productForm.imageUrl}
                          onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })}
                          placeholder="/uploads/... o /src/assets/images/..."
                          className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-xs font-mono text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-200/70">
                  <button
                    type="button"
                    onClick={() => setIsProductModalOpen(false)}
                    disabled={isSubmittingProduct}
                    className="py-2.5 px-4 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-100 text-xs font-bold cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingProduct || isUploadingImage}
                    className="py-2.5 px-6 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSubmittingProduct ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Guardando Amigurumi...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>{editingProduct ? 'Actualizar Amigurumi' : 'Guardar en Catálogo'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* MODAL 6: ARTISANAL TECHNICAL SHEET INSPECTOR (FASE 2F.5) */}
        {/* ============================================================= */}
        {isDetailModalOpen && detailProduct && (
          <div className="fixed inset-0 bg-stone-950/60 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="w-full max-w-2xl bg-white/95 rounded-3xl border border-white/80 shadow-2xl p-6 sm:p-7 space-y-5 animate-fadeIn my-6">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-stone-200/70">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-amber-700" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-stone-900 font-sans">
                      Ficha Técnica Artesanal
                    </h3>
                    <p className="text-[11px] font-mono text-amber-900 font-bold">
                      SKU: {detailProduct.sku || detailProduct.id} &bull; {detailProduct.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Main Info Hero */}
              <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-2xl bg-amber-50/60 border border-amber-200/70 items-center sm:items-start">
                <div className="w-24 h-24 rounded-xl overflow-hidden bg-white border border-amber-200 shrink-0 shadow-xs">
                  <img
                    src={detailProduct.imageUrl || '/src/assets/images/hero_amigurumi_showcase_1794329731742.jpg'}
                    alt={detailProduct.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="space-y-1.5 text-center sm:text-left flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h4 className="font-extrabold text-sm text-stone-900 font-sans">{detailProduct.name}</h4>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      {detailProduct.status === 'published' ? 'En Vitrina' : detailProduct.status === 'out_of_stock' ? 'Agotado' : 'Oculto'}
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 line-clamp-2">
                    {detailProduct.shortDescription || detailProduct.fullDescription}
                  </p>
                  <div className="flex items-center justify-center sm:justify-start gap-4 pt-1 text-xs">
                    <span className="font-bold text-amber-900 text-sm">{formatCOP(detailProduct.price)}</span>
                    <span className="text-stone-500 font-medium">
                      Stock: <strong className="text-stone-900">{detailProduct.stockUnits ?? 0} unid.</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Craft Specifications Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/70">
                  <span className="text-[10px] uppercase font-bold text-stone-500 block mb-1">Dimensiones</span>
                  <p className="font-bold text-stone-800">
                    {detailProduct.dimensions
                      ? `${detailProduct.dimensions.heightCm} alto × ${detailProduct.dimensions.widthCm} ancho ${detailProduct.dimensions.depthCm ? `× ${detailProduct.dimensions.depthCm} prof.` : ''} cm`
                      : '20 × 12 cm'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/70">
                  <span className="text-[10px] uppercase font-bold text-stone-500 block mb-1">Tiempo de Tejido</span>
                  <p className="font-bold text-amber-900">
                    {detailProduct.approxCraftTimeHours || 5} horas estimadas
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/70">
                  <span className="text-[10px] uppercase font-bold text-stone-500 block mb-1">Nivel Dificultad</span>
                  <p className="font-bold text-stone-800">{detailProduct.difficulty || 'Intermedia'}</p>
                </div>

                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/70 sm:col-span-2">
                  <span className="text-[10px] uppercase font-bold text-stone-500 block mb-1">Técnica de Crochet</span>
                  <p className="font-semibold text-stone-800">{detailProduct.weaveType || 'Punto bajo en espiral continua'}</p>
                </div>

                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/70">
                  <span className="text-[10px] uppercase font-bold text-stone-500 block mb-1">Paleta de Colores</span>
                  <p className="font-semibold text-stone-800">{detailProduct.colors || 'Tostado, marfil'}</p>
                </div>

                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/70 sm:col-span-3">
                  <span className="text-[10px] uppercase font-bold text-stone-500 block mb-1">Materiales e Insumos</span>
                  <p className="text-stone-700 leading-relaxed">
                    {Array.isArray(detailProduct.materials)
                      ? detailProduct.materials.join(', ')
                      : detailProduct.materials || 'Hilo 100% algodón rústico peinado, Vellón siliconado hipoalergénico, Ojos de seguridad con traba'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/70 sm:col-span-3">
                  <span className="text-[10px] uppercase font-bold text-stone-500 block mb-1">Cuidados & Conservación</span>
                  <p className="text-stone-700 leading-relaxed">
                    {detailProduct.careInstructions || 'Lavar a mano con agua fría y jabón suave. Secar horizontal a la sombra sin retorcer.'}
                  </p>
                </div>

                {detailProduct.fullDescription && (
                  <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/70 sm:col-span-3">
                    <span className="text-[10px] uppercase font-bold text-stone-500 block mb-1">Descripción Detallada</span>
                    <p className="text-stone-700 leading-relaxed whitespace-pre-line text-[11px]">
                      {detailProduct.fullDescription}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-stone-200/70">
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleOpenEditProduct(detailProduct);
                  }}
                  className="py-2 px-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                  <span>Modificar Datos</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="py-2 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold cursor-pointer transition-colors"
                >
                  Cerrar Ficha
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
