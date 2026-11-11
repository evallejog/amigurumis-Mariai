/**
 * Definiciones de tipos para la plataforma de Amigurumis Artesanales
 * Inspirado en el lenguaje visual Liquid Glass de Apple y arquitectura de e-commerce.
 */

export type ProductAvailability = 'in_stock' | 'low_stock' | 'made_to_order' | 'out_of_stock' | 'pending_confirmation';

export interface Product {
  id: string;
  name: string;
  category: 'animales' | 'marinos' | 'fantasia' | 'botanica' | 'personalizados';
  shortDescription: string;
  fullDescription: string;
  price: number;
  currency: string;
  availability: ProductAvailability;
  stockUnits?: number;
  dimensions?: {
    heightCm: number;
    widthCm: number;
  };
  materials: string[];
  approxCraftTimeHours?: number;
  featured?: boolean;
  imagePlaceholderText?: string;
  imageUrl?: string;
  tags: string[];
  difficulty?: 'Principiante' | 'Intermedio' | 'Avanzado';
}

export interface CategoryOption {
  id: string;
  name: string;
  description: string;
  itemCount?: number;
}

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  customDetails?: {
    isAiGenerated?: boolean;
    prompt?: string;
    style?: string;
    patternSummary?: string;
    customColors?: string[];
  };
}

export interface AiPatternRound {
  round: string;
  instruction: string;
  notes?: string;
}

export interface AiPatternSection {
  title: string;
  rounds: AiPatternRound[];
}

export interface AiGeneratedAmigurumi {
  id: string;
  name: string;
  conceptPrompt: string;
  style: string;
  summary: string;
  difficulty: 'Principiante' | 'Intermedio' | 'Avanzado';
  estimatedTime: string;
  dimensions: string;
  hookRecommended: string;
  materials: string[];
  abbreviations: { code: string; meaning: string }[];
  palette: { name: string; hex: string }[];
  sections: AiPatternSection[];
  assemblySteps: string[];
  careTips: string[];
  suggestedPrice: number;
  imageUrl: string;
}

export interface CustomerInfo {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  apartment?: string;
  city: string;
  postalCode: string;
  notes?: string;
}

export type ShippingMethod = 'standard' | 'express' | 'pickup';

export type PaymentMethod = 'apple_pay' | 'credit_card' | 'bank_transfer' | 'cash_on_delivery';

export interface OrderDetails {
  orderId: string;
  createdAt: string;
  customer: CustomerInfo;
  shippingMethod: ShippingMethod;
  paymentMethod: PaymentMethod;
  items: CartItem[];
  subtotal: number;
  shippingCost: number;
  discount: number;
  total: number;
  status: 'confirmed' | 'processing' | 'crafting';
}

export interface BusinessConfig {
  brandName: string;
  provisionalTag: string;
  tagline: string;
  aboutText: string;
  craftPhilosophy: string;
  contact: {
    whatsappNumberPlaceholder: string;
    whatsappDisplayText: string;
    emailPlaceholder: string;
    locationPlaceholder: string;
    workshopHours: string;
    instagramPlaceholder: string;
  };
}

// Re-exportación de contratos de analítica, BTL y Machine Learning [PREPARADO]
export * from './analytics';
