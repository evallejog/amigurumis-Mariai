import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, CartItem, OrderDetails } from '../types';

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

const STORAGE_KEY = 'amigurumis_mariai_cart_v2';
const LEGACY_STORAGE_KEY = 'atelier_amigurumi_cart_v1';
const PENDING_COUPON_KEY = 'amigurumis_mariai_pending_coupon';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [pendingCouponCode, setPendingCouponCodeState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(PENDING_COUPON_KEY);
    } catch {
      return null;
    }
  });

  const setPendingCouponCode = (code: string | null) => {
    setPendingCouponCodeState(code);
    try {
      if (code) {
        localStorage.setItem(PENDING_COUPON_KEY, code);
      } else {
        localStorage.removeItem(PENDING_COUPON_KEY);
      }
    } catch {}
  };

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [lastOrder, setLastOrder] = useState<OrderDetails | null>(null);
  const [shippingCost, setShippingCost] = useState<number | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Error saving cart to local storage', e);
    }
  }, [items]);

  const addToCart = (product: Product, quantity = 1, customDetails?: CartItem['customDetails']) => {
    setItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.product.id === product.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
        };
        return updated;
      }

      return [
        ...prev,
        {
          id: `cart-${product.id}-${Date.now()}`,
          product,
          quantity,
          customDetails,
        },
      ];
    });

    setIsCartOpen(true);
  };

  const removeFromCart = (itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((item) => {
          if (item.id === itemId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const clearCart = () => {
    setItems([]);
    setShippingCost(null);
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
