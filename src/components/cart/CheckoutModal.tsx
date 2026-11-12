import React, { useState, useEffect } from 'react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { getAnalyticsSessionId, track } from '../../analytics/client';
import { CustomerInfo, ShippingMethod, PaymentMethod, OrderDetails } from '../../types';
import {
  X,
  CreditCard,
  Building,
  Truck,
  CheckCircle2,
  Lock,
  ArrowRight,
  ArrowLeft,
  Smartphone,
  Copy,
  Check,
  Package,
  Calendar,
  Download,
  Share2,
  Info,
  FileText,
  Tag,
  CheckCircle,
  AlertCircle as AlertIcon,
  Trash2
} from 'lucide-react';

export const CheckoutModal: React.FC = () => {
  const {
    isCheckoutOpen,
    setIsCheckoutOpen,
    items,
    subtotal,
    shippingCost,
    setCalculatedShipping,
    total,
    clearCart,
    setLastOrder,
    pendingCouponCode,
    setPendingCouponCode,
  } = useCart();

  const { user, token } = useAuth();

  const [step, setStep] = useState<'details' | 'payment' | 'confirmation'>('details');
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('standard');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<any>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Coupon state
  const [couponInput, setCouponInput] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountPercent: number;
    discountAmount: number;
  } | null>(null);

  // Customer form state localized for Colombia, auto-filled from auth if available
  const [customer, setCustomer] = useState<CustomerInfo>({
    fullName: user?.fullName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
    apartment: '',
    city: user?.city || '',
    postalCode: '',
    notes: '',
  });

  // Reset checkout modal state whenever reopened to allow seamless consecutive purchases
  useEffect(() => {
    if (isCheckoutOpen) {
      if (step === 'confirmation') {
        setStep('details');
        setConfirmedOrder(null);
        setAppliedCoupon(null);
        setCouponSuccess(null);
        setCouponError(null);
        setCouponInput('');
        setPaymentError(null);
      }

      // Check if there is an earned coupon waiting to be used
      if (pendingCouponCode && !appliedCoupon) {
        setCouponInput(pendingCouponCode);
      }
    }
  }, [isCheckoutOpen]);

  // Autocomplete empty customer fields from authenticated user without overwriting manual user typing
  useEffect(() => {
    if (user) {
      setCustomer((prev) => ({
        fullName: prev.fullName.trim() ? prev.fullName : user.fullName || '',
        email: prev.email.trim() ? prev.email : user.email || '',
        phone: prev.phone.trim() ? prev.phone : user.phone || '',
        address: prev.address.trim() ? prev.address : user.address || '',
        apartment: prev.apartment,
        city: prev.city.trim() ? prev.city : user.city || '',
        postalCode: prev.postalCode,
        notes: prev.notes,
      }));
    }
  }, [user]);

  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CustomerInfo, string>>>({});

  const handleCloseModal = () => {
    setIsCheckoutOpen(false);
    setTimeout(() => {
      setStep('details');
      setConfirmedOrder(null);
      setAppliedCoupon(null);
      setCouponSuccess(null);
      setCouponError(null);
      setCouponInput('');
      setFormErrors({});
      setPaymentError(null);
      setIsProcessing(false);
    }, 200);
  };

  if (!isCheckoutOpen) return null;

  // Shipping cost lookup for Colombia
  const getSelectedShippingCost = (method: ShippingMethod): number => {
    switch (method) {
      case 'standard':
        return 12000;
      case 'express':
        return 18000;
      case 'pickup':
        return 0;
      default:
        return 12000;
    }
  };

  const handleInputChange = (field: keyof CustomerInfo, value: string) => {
    setCustomer((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleShippingChange = (method: ShippingMethod) => {
    setShippingMethod(method);
    const cost = getSelectedShippingCost(method);
    setCalculatedShipping(cost);
  };

  const validateDetails = (): boolean => {
    const errors: Partial<Record<keyof CustomerInfo, string>> = {};
    if (!customer.fullName.trim()) errors.fullName = 'Ingresa tu nombre completo';
    if (!customer.email.trim() || !customer.email.includes('@')) errors.email = 'Ingresa un correo electrónico válido';
    if (!customer.phone.trim()) errors.phone = 'Ingresa un teléfono o WhatsApp de contacto';
    if (!customer.address.trim()) errors.address = 'Ingresa la dirección de entrega';
    if (!customer.city.trim()) errors.city = 'Ingresa la ciudad y departamento en Colombia';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleApplyCoupon = async (overrideCode?: string) => {
    const rawCode = overrideCode || couponInput;
    const code = rawCode.trim().toUpperCase();
    if (!code) {
      setCouponError('Ingresa un código de descuento');
      return;
    }
    setCouponLoading(true);
    setCouponError(null);
    setCouponSuccess(null);

    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          code,
          subtotal,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.valid) {
        throw new Error(data.error || data.message || 'Cupón no válido o no disponible');
      }

      const verifiedCode = data.coupon?.code || data.code || code;
      const discountPercent = data.coupon?.discountPercent ?? data.discountPercent ?? 0;
      const calculatedDiscount = data.coupon?.discountAmount ?? data.discountAmount ?? Math.round(subtotal * (discountPercent / 100));

      setAppliedCoupon({
        code: verifiedCode,
        discountPercent,
        discountAmount: calculatedDiscount,
      });
      setCouponSuccess(`¡Cupón ${verifiedCode} aplicado! ${discountPercent}% de descuento.`);
      setCouponInput('');
      if (setPendingCouponCode) {
        setPendingCouponCode(null);
      }
    } catch (err: any) {
      setCouponError(err.message || 'Error al validar el cupón');
      setAppliedCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponSuccess(null);
    setCouponError(null);
  };

  const currentShippingCost = getSelectedShippingCost(shippingMethod);
  const discountAmount = appliedCoupon ? appliedCoupon.discountAmount : 0;
  const finalCalculatedTotal = Math.max(0, subtotal - discountAmount + currentShippingCost);

  const handleGoToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateDetails()) {
      setCalculatedShipping(currentShippingCost);
      setPaymentError(null);
      setStep('payment');
    }
  };

  const handleCompletePayment = async () => {
    setIsProcessing(true);
    setPaymentError(null);

    const payload = {
      customer,
      shippingMethod,
      paymentMethod,
      couponCode: appliedCoupon?.code,
      items,
      subtotal,
      shippingCost: currentShippingCost,
      total: finalCalculatedTotal,
      analyticsSessionId: getAnalyticsSessionId(),
    };

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al registrar el pedido');
      }

      const orderData: any = await response.json();
      setConfirmedOrder(orderData);
      setLastOrder(orderData);
      setStep('confirmation');
      clearCart();
      window.dispatchEvent(new Event('catalog_updated'));
    } catch (err: any) {
      setPaymentError(err.message || 'Error de conexión al registrar el pedido.');
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (isCheckoutOpen) track({ event_id: crypto.randomUUID(), event_type: 'checkout_started', metadata: { item_count: items.length } });
  }, [isCheckoutOpen]);

  const handleNotifyWhatsApp = () => {
    if (!confirmedOrder) return;
    const itemsSummary = confirmedOrder.items
      .map((it: any) => `• ${it.quantity}x ${it.product?.name || it.productName} ($ ${ ((it.product?.price || it.unitPrice || 0) * it.quantity).toLocaleString('es-CO')} COP)`)
      .join('\n');

    const discountSummary = (confirmedOrder.discount || 0) > 0
      ? `\n*Descuento (${confirmedOrder.couponCode || 'Promoción'}):* -$ ${(confirmedOrder.discount || 0).toLocaleString('es-CO')} COP`
      : '';

    const msg = `¡Hola Amigurumis Mariai! Acabo de registrar mi pedido en la web con el número *${confirmedOrder.orderNumber || confirmedOrder.orderId}*.\n\n*Resumen:*\n${itemsSummary}\n\n*Subtotal:* $ ${confirmedOrder.subtotal.toLocaleString('es-CO')} COP${discountSummary}\n*Envío (${confirmedOrder.shippingMethod}):* $ ${confirmedOrder.shippingCost.toLocaleString('es-CO')} COP\n*Total:* $ ${confirmedOrder.total.toLocaleString('es-CO')} COP\n*Ciudad de Entrega:* ${confirmedOrder.customer?.city || confirmedOrder.shippingCity}\n*Cliente:* ${confirmedOrder.customer?.fullName || confirmedOrder.customerName}\n\nQuedo atento/a para coordinar los detalles de confección y despacho en Colombia. ¡Muchas gracias!`;
    window.open(`https://wa.me/573124567890?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleDownloadReceipt = () => {
    if (!confirmedOrder) return;
    const discountLine = (confirmedOrder.discount || 0) > 0
      ? `Descuento cupón (${confirmedOrder.couponCode || 'Promoción'}): -$ ${(confirmedOrder.discount || 0).toLocaleString('es-CO')} COP\n`
      : '';

    const content = `================================================
AMIGURUMIS MARIAI - RECIBO DE COMPRA (COLOMBIA)
================================================
Nº de Pedido: ${confirmedOrder.orderId}
Fecha: ${new Date(confirmedOrder.createdAt).toLocaleString('es-CO')}
Estado: Registrado en Taller Artesanal

DATOS DEL CLIENTE:
Nombre: ${confirmedOrder.customer?.fullName || confirmedOrder.customerName || 'Cliente'}
Email: ${confirmedOrder.customer?.email || confirmedOrder.customerEmail || ''}
Teléfono: ${confirmedOrder.customer?.phone || confirmedOrder.customerPhone || ''}
Dirección: ${confirmedOrder.customer?.address || confirmedOrder.shippingAddress || ''} ${confirmedOrder.customer?.apartment || ''}
Ciudad / Dpto: ${confirmedOrder.customer?.city || confirmedOrder.shippingCity || 'Colombia'}

ARTÍCULOS CONFECCIONADOS:
${confirmedOrder.items
  .map(
    (item: any, idx: number) =>
      `${idx + 1}. ${item.product?.name || item.productName || 'Amigurumi'} x${item.quantity} - $ ${ ((item.product?.price || item.unitPrice || 0) * item.quantity).toLocaleString('es-CO')} COP`
  )
  .join('\n')}

DESGLOSE FINANCIERO (COP):
Subtotal productos: $ ${confirmedOrder.subtotal.toLocaleString('es-CO')} COP
${discountLine}Envío (${confirmedOrder.shippingMethod}): $ ${confirmedOrder.shippingCost.toLocaleString('es-CO')} COP
TOTAL A PAGAR: $ ${confirmedOrder.total.toLocaleString('es-CO')} COP
Modalidad de Pago seleccionada: ${confirmedOrder.paymentMethod}

TIEMPO ESTIMADO DE CONFECCIÓN Y ENTREGA:
De 3 a 6 días hábiles según técnica artesanal de crochet y destino en Colombia.

Gracias por apoyar el talento y tejido hecho a mano.
================================================`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Recibo_${confirmedOrder.orderId}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const calculatedShippingAmount = currentShippingCost;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6 md:p-10">
      <div
        className="fixed inset-0 bg-stone-900/50 backdrop-blur-md transition-opacity"
        onClick={() => {
          if (step !== 'confirmation') handleCloseModal();
        }}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-2xl liquid-glass-elevated rounded-3xl border border-white/80 shadow-2xl overflow-hidden z-10 transition-all">
        {/* Top Header */}
        <div className="px-6 sm:px-8 py-5 border-b border-stone-200/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-stone-900 text-white flex items-center justify-center text-xs font-bold font-sans">
              {step === 'details' ? '1' : step === 'payment' ? '2' : '✓'}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-sans font-bold text-stone-900">
                {step === 'details'
                  ? 'Datos de Entrega y Envío (Colombia)'
                  : step === 'payment'
                  ? 'Opciones de Pago y Confirmación'
                  : '¡Pedido Registrado con Éxito!'}
              </h3>
              <p className="text-xs text-stone-500 font-normal">
                {step === 'details'
                  ? 'Paso 1 de 2: Dirección y cálculo del envío'
                  : step === 'payment'
                  ? 'Paso 2 de 2: Selecciona la modalidad para coordinar tu pago'
                  : 'Tu solicitud ha ingresado al taller de confección'}
              </p>
            </div>
          </div>
          <button
            onClick={handleCloseModal}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-800 hover:bg-white/80 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1: CUSTOMER & SHIPPING DETAILS */}
        {step === 'details' && (
          <form onSubmit={handleGoToPayment} className="p-6 sm:p-8 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Nombre y Apellido *
                </label>
                <input
                  type="text"
                  value={customer.fullName}
                  onChange={(e) => handleInputChange('fullName', e.target.value)}
                  placeholder="Ej. Valentina Gómez"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/70 border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 text-sm"
                />
                {formErrors.fullName && (
                  <p className="text-[11px] text-rose-600 mt-1">{formErrors.fullName}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Correo Electrónico *
                </label>
                <input
                  type="email"
                  value={customer.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="ejemplo@correo.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/70 border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 text-sm"
                />
                {formErrors.email && (
                  <p className="text-[11px] text-rose-600 mt-1">{formErrors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Teléfono / WhatsApp (Colombia) *
                </label>
                <input
                  type="tel"
                  value={customer.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="Ej. 310 123 4567"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/70 border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 text-sm"
                />
                {formErrors.phone && (
                  <p className="text-[11px] text-rose-600 mt-1">{formErrors.phone}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Ciudad y Departamento *
                </label>
                <input
                  type="text"
                  value={customer.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  placeholder="Ej. Medellín, Antioquia"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/70 border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 text-sm"
                />
                {formErrors.city && (
                  <p className="text-[11px] text-rose-600 mt-1">{formErrors.city}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Dirección de Entrega y Barrio *
                </label>
                <input
                  type="text"
                  value={customer.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="Calle / Carrera / Número y Barrio"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/70 border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 text-sm"
                />
                {formErrors.address && (
                  <p className="text-[11px] text-rose-600 mt-1">{formErrors.address}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Edificio / Apto / Indicaciones adicionales (Opcional)
                </label>
                <input
                  type="text"
                  value={customer.apartment}
                  onChange={(e) => handleInputChange('apartment', e.target.value)}
                  placeholder="Torre 2 Apto 401"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/70 border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 text-sm"
                />
              </div>
            </div>

            {/* Modalidad de Envío para Colombia */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-2">
                Modalidad de Envío
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label
                  onClick={() => handleShippingChange('standard')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    shippingMethod === 'standard'
                      ? 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-500/20 shadow-xs'
                      : 'border-stone-200/80 bg-white/50 hover:bg-white/80'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Truck className="w-4 h-4 text-amber-700" />
                    <span className="text-xs font-bold text-stone-900">Nacional Estándar</span>
                  </div>
                  <p className="text-[11px] text-stone-500">3-5 días hábiles</p>
                  <p className="text-xs font-bold text-stone-800 mt-2 tabular-nums">
                    $ 12.000 COP
                  </p>
                </label>

                <label
                  onClick={() => handleShippingChange('express')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    shippingMethod === 'express'
                      ? 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-500/20 shadow-xs'
                      : 'border-stone-200/80 bg-white/50 hover:bg-white/80'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Truck className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-stone-900">Express Nacional</span>
                  </div>
                  <p className="text-[11px] text-stone-500">1-2 días hábiles</p>
                  <p className="text-xs font-bold text-stone-800 mt-2 tabular-nums">
                    $ 18.000 COP
                  </p>
                </label>

                <label
                  onClick={() => handleShippingChange('pickup')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    shippingMethod === 'pickup'
                      ? 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-500/20 shadow-xs'
                      : 'border-stone-200/80 bg-white/50 hover:bg-white/80'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="w-4 h-4 text-stone-700" />
                    <span className="text-xs font-bold text-stone-900">Coordinar con Taller</span>
                  </div>
                  <p className="text-[11px] text-stone-500">Acuerdo directo</p>
                  <p className="text-xs font-bold text-emerald-700 mt-2">Sin costo</p>
                </label>
              </div>
            </div>

            {/* SECCIÓN DE CUPÓN DE DESCUENTO */}
            <div className="p-4 rounded-2xl bg-white/70 border border-stone-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-amber-700" />
                  <span>Código de descuento</span>
                </label>
                {pendingCouponCode && (
                  <span className="text-[11px] text-amber-800 font-semibold">
                    ¡Cupón de recompensa listo para aplicar!
                  </span>
                )}
              </div>

              {!appliedCoupon ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleApplyCoupon();
                      }
                    }}
                    placeholder="Ingresa tu código"
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 text-xs font-mono uppercase tracking-wider"
                  />
                  <button
                    type="button"
                    onClick={() => handleApplyCoupon()}
                    disabled={couponLoading || !couponInput.trim()}
                    className="px-4 py-2.5 rounded-xl liquid-btn-primary text-white text-xs font-bold cursor-pointer disabled:opacity-50 transition-opacity"
                  >
                    {couponLoading ? 'Validando...' : 'Aplicar'}
                  </button>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-50/90 border border-emerald-300 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-emerald-950 tracking-wider">
                          {appliedCoupon.code}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-200/80 text-emerald-900 text-[10px] font-bold">
                          -{appliedCoupon.discountPercent}%
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-800 font-medium mt-0.5">
                        Ahorras $ {appliedCoupon.discountAmount.toLocaleString('es-CO')} COP en tu pedido
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="p-1.5 rounded-lg text-rose-600 hover:text-rose-800 hover:bg-rose-100/60 transition-colors cursor-pointer"
                    title="Quitar cupón"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              {couponError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>{couponError}</span>
                </div>
              )}

              {couponSuccess && !couponError && (
                <p className="text-[11px] text-emerald-700 font-medium">
                  {couponSuccess}
                </p>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-stone-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-xs text-stone-500">
                  <span>Subtotal: $ {subtotal.toLocaleString('es-CO')} COP</span>
                  {appliedCoupon && (
                    <span className="text-emerald-700 font-semibold">
                      (Desc: -$ {appliedCoupon.discountAmount.toLocaleString('es-CO')} COP)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-500">Total con envío:</span>
                  <p className="text-lg font-sans font-bold text-stone-900 tabular-nums">
                    $ {finalCalculatedTotal.toLocaleString('es-CO')} COP
                  </p>
                </div>
              </div>
              <button
                type="submit"
                className="py-3 px-6 rounded-xl liquid-btn-primary text-white text-sm font-bold flex items-center justify-center gap-2 group cursor-pointer shadow-xs"
              >
                <span>Continuar a Opciones de Pago</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: PAYMENT COORDINATION (DEMOSTRACIÓN ACADÉMICA SIMULADA) */}
        {step === 'payment' && (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-300 text-xs text-amber-950 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold mb-0.5 uppercase tracking-wide text-[11px] text-amber-900">
                  Modo Demostración Académica · Transacción Simulada
                </strong>
                <span className="leading-relaxed">
                  Esta plataforma opera exclusivamente con fines educativos y de demostración técnica. No se procesan cobros bancarios reales, tarjetas de crédito ni transacciones financieras efectivas. Los pedidos generados son simulaciones para verificar el flujo de compra, cupones y generación de comprobantes.
                </span>
              </div>
            </div>

            {/* Gateway Selection Tabs */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod('bank_transfer')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  paymentMethod === 'bank_transfer'
                    ? 'border-stone-900 bg-stone-900 text-white shadow-md'
                    : 'border-stone-200 bg-white/70 text-stone-700 hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <Building className="w-5 h-5" />
                  <span className="text-xs font-bold">Transferencia / Nequi (Simulado)</span>
                </div>
                <p className={`text-[11px] ${paymentMethod === 'bank_transfer' ? 'text-stone-300' : 'text-stone-500'}`}>
                  Simulación de pago bancario de prueba
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('cash_on_delivery')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  paymentMethod === 'cash_on_delivery'
                    ? 'border-stone-900 bg-stone-900 text-white shadow-md'
                    : 'border-stone-200 bg-white/70 text-stone-700 hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <Truck className="w-5 h-5" />
                  <span className="text-xs font-bold">Contra Entrega (Simulado)</span>
                </div>
                <p className={`text-[11px] ${paymentMethod === 'cash_on_delivery' ? 'text-stone-300' : 'text-stone-500'}`}>
                  Simulación de entrega presencial
                </p>
              </button>
            </div>

            {/* Details according to selected method */}
            {paymentMethod === 'bank_transfer' && (
              <div className="liquid-glass rounded-2xl p-5 border border-white/80 space-y-3 text-xs text-stone-700">
                <h4 className="font-bold text-stone-900 text-sm">Transferencia Bancaria en Colombia</h4>
                <p className="leading-relaxed">
                  Una vez confirmes la orden, nuestro equipo se comunicará por WhatsApp o correo para suministrarte los datos de transferencia y coordinar el despacho.
                </p>
                <div className="p-3 bg-white/80 rounded-xl border border-stone-200/60 text-stone-600 space-y-1">
                  <div>• <strong>Moneda:</strong> Pesos Colombianos (COP)</div>
                  {appliedCoupon && (
                    <div className="text-emerald-700 font-semibold">
                      • <strong>Cupón aplicado:</strong> {appliedCoupon.code} (-{appliedCoupon.discountPercent}%)
                    </div>
                  )}
                  <div>• <strong>Total a transferir:</strong> $ {finalCalculatedTotal.toLocaleString('es-CO')} COP</div>
                </div>
              </div>
            )}

            {paymentMethod === 'cash_on_delivery' && (
              <div className="liquid-glass rounded-2xl p-5 border border-white/80 space-y-3 text-xs text-stone-700">
                <h4 className="font-bold text-stone-900 text-sm">Pago Contra Entrega</h4>
                <p className="leading-relaxed">
                  Pagas en efectivo al mensajero cuando recibas tu paquete en tu domicilio en Colombia. Coordinaremos el horario previo con la transportadora.
                </p>
                <div className="p-3 bg-white/80 rounded-xl border border-stone-200/60 text-stone-600 space-y-1">
                  {appliedCoupon && (
                    <div className="text-emerald-700 font-semibold">
                      • <strong>Cupón aplicado:</strong> {appliedCoupon.code} (-{appliedCoupon.discountPercent}%)
                    </div>
                  )}
                  <div>• <strong>Monto a pagar al recibir:</strong> $ {finalCalculatedTotal.toLocaleString('es-CO')} COP</div>
                </div>
              </div>
            )}

            {paymentError && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertIcon className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{paymentError}</span>
              </div>
            )}

            {/* Back button and Confirm button */}
            <div className="flex items-center justify-between pt-4 border-t border-stone-200/50">
              <button
                type="button"
                onClick={() => setStep('details')}
                className="text-xs font-semibold text-stone-600 hover:text-stone-900 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver a datos de entrega</span>
              </button>

              <button
                onClick={handleCompletePayment}
                disabled={isProcessing}
                className="py-3 px-6 rounded-xl liquid-btn-primary text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? 'Registrando Pedido...' : 'Confirmar y Enviar al Taller'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: ORDER CONFIRMATION & RECEIPT */}
        {step === 'confirmation' && confirmedOrder && (
          <div className="p-6 sm:p-8 space-y-6 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <h3 className="text-xl font-sans font-bold text-stone-900">¡Gracias por tu compra artesanal!</h3>
              <p className="text-xs sm:text-sm text-stone-600 mt-1 font-normal">
                Hemos registrado tu pedido y enviado la confirmación a{' '}
                <strong className="text-stone-800">{confirmedOrder.customer?.email || confirmedOrder.customerEmail}</strong>
              </p>
            </div>

            {/* Order Card summary */}
            <div className="liquid-glass rounded-2xl p-5 border border-white/80 text-left space-y-3.5">
              <div className="flex items-center justify-between pb-3 border-b border-stone-200/50">
                <div>
                  <span className="text-[11px] text-stone-500 uppercase tracking-wider font-bold">
                    Identificador de Pedido
                  </span>
                  <p className="text-sm font-sans font-bold text-stone-900">
                    {confirmedOrder.orderId}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-stone-500 uppercase tracking-wider font-bold">
                    Fecha y Hora
                  </span>
                  <p className="text-xs text-stone-700 font-medium">
                    {new Date(confirmedOrder.createdAt).toLocaleDateString('es-CO', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>

              {/* Items Breakdown */}
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {confirmedOrder.items.map((it: any) => (
                  <div key={it.id || it.productId} className="flex items-center justify-between text-xs py-1">
                    <div className="flex items-center gap-2">
                      <span className="w-5 text-stone-400">x{it.quantity}</span>
                      <span className="font-bold text-stone-900">{it.product?.name || it.productName || 'Amigurumi'}</span>
                    </div>
                    <span className="font-bold text-stone-800 tabular-nums">
                      $ {((it.product?.price || it.unitPrice || 0) * it.quantity).toLocaleString('es-CO')} COP
                    </span>
                  </div>
                ))}
              </div>

              {/* Financials */}
              <div className="pt-3 border-t border-stone-200/60 space-y-1.5 text-xs text-stone-600">
                <div className="flex justify-between">
                  <span>Subtotal productos:</span>
                  <span className="tabular-nums font-semibold">$ {confirmedOrder.subtotal.toLocaleString('es-CO')} COP</span>
                </div>
                {(confirmedOrder.discount || 0) > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Descuento cupón {confirmedOrder.couponCode ? `(${confirmedOrder.couponCode})` : 'Promoción'}:</span>
                    <span className="tabular-nums">-$ {(confirmedOrder.discount || 0).toLocaleString('es-CO')} COP</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Envío ({confirmedOrder.shippingMethod}):</span>
                  <span className="tabular-nums font-semibold">$ {confirmedOrder.shippingCost.toLocaleString('es-CO')} COP</span>
                </div>
                <div className="pt-2 border-t border-stone-200/60 flex items-center justify-between text-sm font-bold text-stone-900">
                  <span>Total Pedido:</span>
                  <span className="text-base tabular-nums">$ {confirmedOrder.total.toLocaleString('es-CO')} COP</span>
                </div>
              </div>
            </div>

            {/* Estimated Schedule */}
            <div className="flex items-center gap-3 p-3.5 bg-amber-50/70 rounded-xl border border-amber-200/50 text-left text-xs text-stone-700">
              <Calendar className="w-5 h-5 text-amber-700 shrink-0" />
              <div>
                <strong>Tiempo estimado de confección y despacho:</strong> 3 a 6 días hábiles en Colombia. Cada amigurumi es tejido a mano punto a punto.
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <a
                href={`/api/orders/${confirmedOrder.id || confirmedOrder.orderId}/pdf${
                  confirmedOrder.accessToken || confirmedOrder.access_token
                    ? `?token=${confirmedOrder.accessToken || confirmedOrder.access_token}`
                    : ''
                }`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 px-4 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Descargar Comprobante PDF (Demo)</span>
              </a>

              <button
                onClick={handleNotifyWhatsApp}
                className="flex-1 py-3 px-4 rounded-xl liquid-btn-secondary text-emerald-800 border-emerald-200 hover:bg-emerald-50 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>Coordinar por WhatsApp</span>
              </button>
            </div>

            <p className="text-[10px] text-stone-500 font-normal leading-relaxed">
              * DEMOSTRACIÓN ACADÉMICA: Transacción simulada sin cobro real ni procesamiento bancario. El comprobante generado es de orden interna y no constituye factura electrónica DIAN ni documento contable fiscal.
            </p>

            <button
              onClick={handleCloseModal}
              className="w-full py-3 px-4 rounded-xl liquid-btn-primary text-white text-xs font-bold cursor-pointer"
            >
              Volver a la Tienda
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
