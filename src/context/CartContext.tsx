import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Product, CartItem, OrderDetails } from '../types';
import { useAuth } from './AuthContext';
import { track } from '../analytics/client';

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number, customDetails?: CartItem['customDetails']) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, delta: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  isCheckoutOpen: boolean;
  setIsCheckoutOpen: (open: boolean) => void;
  lastOrder: OrderDetails | null;
  setLastOrder: (order: OrderDetails | null) => void;
  pendingCouponCode: string | null;
  setPendingCouponCode: (code: string | null) => void;
  itemCount: number;
  subtotal: number;
  isShippingCalculated: boolean;
  shippingCost: number | null;
  setCalculatedShipping: (cost: number | null) => void;
  total: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const getCartStorageKey = (userId?: string | null) => {
  return userId ? `amigurumis_mariai_cart_user_${userId}` : 'amigurumis_mariai_cart_guest';
};

export const getCouponStorageKey = (userId?: string | null) => {
  return userId ? `amigurumis_mariai_coupon_user_${userId}` : 'amigurumis_mariai_coupon_guest';
};

const LEGACY_STORAGE_KEY = 'amigurumis_mariai_cart_v2';
const LEGACY_PENDING_KEY = 'amigurumis_mariai_pending_coupon';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const currentUserId = user?.id || null;
  const activeUserRef = useRef<string | null>(currentUserId);

  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const key = getCartStorageKey(currentUserId);
      const saved = localStorage.getItem(key) || (!currentUserId ? localStorage.getItem(LEGACY_STORAGE_KEY) : null);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [pendingCouponCode, setPendingCouponCodeState] = useState<string | null>(() => {
    try {
      const key = getCouponStorageKey(currentUserId);
      return localStorage.getItem(key) || (!currentUserId ? localStorage.getItem(LEGACY_PENDING_KEY) : null);
    } catch {
      return null;
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [lastOrder, setLastOrder] = useState<OrderDetails | null>(null);
  const [shippingCost, setShippingCost] = useState<number | null>(null);

  // Switch cart and coupon when authenticated user changes (prevents bleed between accounts)
  useEffect(() => {
    const prevUserId = activeUserRef.current;
    if (prevUserId !== currentUserId) {
      // 1. Save previous state to previous user's keys
      try {
        const prevCartKey = getCartStorageKey(prevUserId);
        const prevCouponKey = getCouponStorageKey(prevUserId);
        localStorage.setItem(prevCartKey, JSON.stringify(items));
        if (pendingCouponCode) {
          localStorage.setItem(prevCouponKey, pendingCouponCode);
        } else {
          localStorage.removeItem(prevCouponKey);
        }
      } catch (e) {
        console.error('Error saving previous cart state', e);
      }

      // 2. Load new user's cart and coupon
      try {
        const newCartKey = getCartStorageKey(currentUserId);
        const newCouponKey = getCouponStorageKey(currentUserId);
        const savedNewCart = localStorage.getItem(newCartKey);
        const parsedItems: CartItem[] = savedNewCart ? JSON.parse(savedNewCart) : [];
        setItems(parsedItems);

        const savedNewCoupon = localStorage.getItem(newCouponKey);
        setPendingCouponCodeState(savedNewCoupon || null);
      } catch (e) {
        console.error('Error loading new user cart state', e);
        setItems([]);
        setPendingCouponCodeState(null);
      }

      setShippingCost(null);
      activeUserRef.current = currentUserId;
    }
  }, [currentUserId]);

  const setPendingCouponCode = (code: string | null) => {
    setPendingCouponCodeState(code);
    try {
      const key = getCouponStorageKey(currentUserId);
      if (code) {
        localStorage.setItem(key, code);
      } else {
        localStorage.removeItem(key);
      }
    } catch {}
  };

  // Sync current items with current active user's storage key
  useEffect(() => {
    if (activeUserRef.current === currentUserId) {
      try {
        const key = getCartStorageKey(currentUserId);
        localStorage.setItem(key, JSON.stringify(items));
      } catch (e) {
        console.error('Error saving cart to local storage', e);
      }
    }
  }, [items, currentUserId]);

  const addToCart = (product: Product, quantity = 1, customDetails?: CartItem['customDetails']) => {
    // Verificar si el amigurumi está agotado
    const isOutOfStock =
      product.availability === 'out_of_stock' ||
      (typeof product.stockUnits === 'number' && product.stockUnits <= 0) ||
      product.status === 'out_of_stock' ||
      product.status === 'hidden';

    if (isOutOfStock) {
      console.warn(`[CART] Intento de agregar producto agotado: ${product.name}`);
      return;
    }
    track({ event_id: crypto.randomUUID(), event_type: 'cart_item_added', product_id: product.id, metadata: { quantity: Math.max(1, Math.floor(quantity)) } });

    const availableStock = typeof product.stockUnits === 'number' ? product.stockUnits : 999;
    const requestedQty = Math.max(1, quantity);

    setItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.product.id === product.id);
      if (existingIndex > -1) {
        const currentQty = prev[existingIndex].quantity;
        const targetQty = Math.min(availableStock, currentQty + requestedQty);
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: targetQty,
        };
        return updated;
      }

      const initialQty = Math.min(availableStock, requestedQty);
      return [
        ...prev,
        {
          id: `cart-${product.id}-${Date.now()}`,
          product,
          quantity: initialQty,
          customDetails,
        },
      ];
    });

    setIsCartOpen(true);
  };

  const removeFromCart = (itemId: string) => {
    const item = items.find((entry) => entry.id === itemId);
    if (item) track({ event_id: crypto.randomUUID(), event_type: 'cart_item_removed', product_id: item.product.id, metadata: { quantity: item.quantity } });
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((item) => {
          if (item.id === itemId) {
            const availableStock =
              typeof item.product.stockUnits === 'number' ? item.product.stockUnits : 999;
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            return { ...item, quantity: Math.min(availableStock, newQty) };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const clearCart = () => {
    setItems([]);
    setShippingCost(null);
    setPendingCouponCodeState(null);
    try {
      const cartKey = getCartStorageKey(currentUserId);
      const couponKey = getCouponStorageKey(currentUserId);
      localStorage.removeItem(cartKey);
      localStorage.removeItem(couponKey);
    } catch {}
  };

  const setCalculatedShipping = (cost: number | null) => {
    setShippingCost(cost);
  };

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const isShippingCalculated = shippingCost !== null;
  const total = subtotal + (shippingCost || 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        isCartOpen,
        setIsCartOpen,
        isCheckoutOpen,
        setIsCheckoutOpen,
        lastOrder,
        setLastOrder,
        pendingCouponCode,
        setPendingCouponCode,
        itemCount,
        subtotal,
        isShippingCalculated,
        shippingCost,
        setCalculatedShipping,
        total,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
