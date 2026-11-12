/**
 * CONTRATOS DE ARQUITECTURA ANALÍTICA, TELEMETRÍA, GAMIFICACIÓN BTL Y MACHINE LEARNING
 * 
 * Plataforma: Tienda de Amigurumis Artesanales
 * Estado: [PREPARADO] — Definición formal de contratos sin ejecución prematura.
 * 
 * Este archivo establece las interfaces de datos estandarizadas para:
 * 1. Telemetría de eventos (comerciales, navegación, BTL).
 * 2. Motor de gamificación y recompensas seguras.
 * 3. Contratos de inferencia para modelos de Machine Learning.
 * 4. Esquemas de agregación para el dashboard administrativo y pipelines de datos.
 */

// ============================================================================
// 1. ESQUEMA ESTÁNDAR DE TELEMETRÍA Y EVENTOS (DATA PIPELINE)
// ============================================================================

export type CommercialEventType =
  | 'product_viewed'
  | 'product_searched'
  | 'product_filtered'
  | 'cart_item_added'
  | 'cart_item_removed'
  | 'cart_quantity_changed'
  | 'cart_cleared'
  | 'checkout_started'
  | 'checkout_step_completed'
  | 'order_placed'
  | 'order_failed';

export type NavigationEventType =
  | 'page_viewed'
  | 'section_navigated'
  | 'modal_opened'
  | 'modal_closed'
  | 'whatsapp_inquiry_clicked'
  | 'receipt_downloaded';

export type BtlGameEventType =
  | 'game_initialized'
  | 'game_started'
  | 'level_started'
  | 'level_completed'
  | 'level_failed'
  | 'level_retried'
  | 'game_finished'
  | 'reward_earned'
  | 'coupon_issued'
  | 'coupon_applied_to_cart'
  | 'coupon_redeemed';

export type AnalyticsEventType =
  | CommercialEventType
  | NavigationEventType
  | BtlGameEventType;

export interface AnalyticsEvent<TMetadata = Record<string, unknown>> {
  /** Identificador único universal del evento (UUID v4) */
  event_id: string;
  /** Tipo normalizado de evento */
  event_type: AnalyticsEventType;
  /** Marca temporal en formato ISO 8601 UTC */
  timestamp: string;
  /** Versión del esquema para permitir evolución sin romper pipelines (SemVer) */
  schema_version: '1.0.0';
  /** Identificador anónimo de sesión de navegación */
  session_id: string;
  /** Identificador seudonimizado del usuario (nulo para usuarios invitados) */
  user_id?: string;
  /** Identificador de producto asociado si aplica */
  product_id?: string;
  /** Identificador de pedido asociado si aplica */
  order_id?: string;
  /** Identificador de campaña publicitaria o promocional */
  campaign_id?: string;
  /** Identificador de la sesión de juego BTL si aplica */
  game_session_id?: string;
  /** Carga útil con metadatos específicos del evento */
  metadata: TMetadata;
}

/** Envelope accepted by POST /api/analytics/events. Identity and received time are server-owned. */
export interface AnalyticsEventInput {
  event_id: string;
  event_type: AnalyticsEventType;
  timestamp?: string;
  schema_version?: '1.0.0';
  session_id: string;
  anonymous_id?: string;
  product_id?: string;
  metadata?: Record<string, unknown>;
}

export interface EventBatch {
  batch_id: string;
  sent_at: string;
  events: AnalyticsEvent[];
}

// ============================================================================
// 2. CONTRATOS DEL MINIVIDEOJUEGO BTL Y SISTEMA SEGURO DE RECOMPENSAS
// ============================================================================

export type GameDifficulty = 'facil' | 'medio' | 'experto';

export interface BtlGameSession {
  game_session_id: string;
  anonymous_player_id: string;
  started_at: string;
  current_level: number;
  max_unlocked_level: number;
  total_score: number;
  lives_remaining: number;
  is_completed: boolean;
  /** Token criptográfico (HMAC) emitido por el servidor para prevenir manipulación */
  session_integrity_hash?: string;
}

export interface BtlLevelAttempt {
  level_id: number;
  difficulty: GameDifficulty;
  score_achieved: number;
  time_elapsed_seconds: number;
  objectives_met: boolean;
  moves_count?: number;
}

export type RewardType = 'percentage_discount' | 'fixed_discount' | 'free_shipping' | 'special_gift';

export interface BtlRewardCriteria {
  reward_id: string;
  title: string;
  description: string;
  type: RewardType;
  discount_value: number; // Porcentaje (ej. 15) o monto fijo (ej. 3000)
  min_order_value?: number;
  level_required_to_unlock: number;
  max_redemptions_per_user: number;
  validity_days: number;
}

export interface BtlIssuedCoupon {
  coupon_code: string;
  reward_id: string;
  game_session_id: string;
  issued_at: string;
  expires_at: string;
  discount_type: RewardType;
  discount_amount: number;
  min_subtotal_required: number;
  is_redeemed: boolean;
  redeemed_at?: string;
  redeemed_order_id?: string;
  /** Firma de autenticidad calculada del lado servidor */
  validation_signature: string;
}

export interface BtlCouponValidationRequest {
  coupon_code: string;
  cart_subtotal: number;
  session_id: string;
}

export interface BtlCouponValidationResponse {
  is_valid: boolean;
  reason?: 'expired' | 'already_redeemed' | 'subtotal_not_met' | 'invalid_code' | 'max_usage_reached';
  discount_applied?: number;
  message: string;
  coupon?: Omit<BtlIssuedCoupon, 'validation_signature'>;
}

// ============================================================================
// 3. CONTRATOS DE MACHINE LEARNING Y CIENCIA DE DATOS
// ============================================================================

export interface DemandForecastResult {
  sku_id: string;
  product_name: string;
  category: string;
  forecast_horizon_days: number;
  generated_at: string;
  model_identifier: string; // ej. 'prophet_amigurumi_v1.2'
  predicted_units_demanded: number;
  confidence_interval_95: {
    lower_bound: number;
    upper_bound: number;
  };
  key_drivers: {
    seasonal_factor: number;
    trend_factor: number;
    btl_campaign_uplift: number;
  };
}

export interface SalesForecastResult {
  forecast_period: 'next_7_days' | 'next_30_days' | 'next_quarter';
  predicted_revenue: number;
  predicted_orders_count: number;
  projected_avg_ticket: number;
  confidence_score: number; // 0.0 a 1.0
  model_version: string;
}

export type CustomerSegmentCategory =
  | 'champions'           // Alta frecuencia, alto gasto, reciente
  | 'loyal_crafters'      // Frecuentes, gasto medio
  | 'promising_gamers'    // Jugaron BTL, obtuvieron cupón, primera compra
  | 'occasional_gifters'  // Compran solo en fechas especiales
  | 'at_risk'             // Antiguos clientes sin compras recientes
  | 'new_explorers';      // Recién llegados sin historial consolidado

export interface CustomerSegmentResult {
  segment_id: CustomerSegmentCategory;
  segment_display_name: string;
  customer_count: number;
  percentage_of_total: number;
  avg_clv_estimated: number; // Customer Lifetime Value estimado
  recommended_commercial_action: string;
}

export interface BtlConversionCorrelation {
  analyzed_period: string;
  total_game_sessions: number;
  coupons_issued: number;
  coupons_redeemed: number;
  redemption_rate_percentage: number;
  avg_ticket_with_gamified_coupon: number;
  avg_ticket_organic: number;
  measured_revenue_uplift: number;
  /** Advertencia metodológica obligatoria */
  statistical_significance_p_value?: number;
  correlation_caveat: string;
}

// ============================================================================
// 4. CONTRATOS DE INGENIERÍA DE DATOS Y BIG DATA PIPELINES
// ============================================================================

export type PipelineStage = 'ingestion' | 'validation' | 'curation' | 'aggregation' | 'serving';

export interface DataPipelineStatus {
  pipeline_name: string;
  current_stage: PipelineStage;
  status: 'healthy' | 'degraded' | 'idle' | 'executing';
  last_successful_run: string;
  events_processed_last_24h: number;
  error_rate_percentage: number;
  storage_size_mb: number;
}

export interface SyntheticDatasetMetadata {
  is_synthetic: true;
  generator_module: string;
  records_count: number;
  simulation_scenario: string;
  created_at: string;
  purpose: 'benchmarking' | 'stress_testing' | 'academic_demonstration';
}

// ============================================================================
// 5. CONTRATOS PARA EL PANEL ADMINISTRATIVO INTEGRAL (DASHBOARD)
// ============================================================================

export interface CommercialKpisSummary {
  period: string;
  gross_revenue: number;
  orders_count: number;
  average_order_value: number;
  top_selling_products: {
    product_id: string;
    product_name: string;
    units_sold: number;
    revenue: number;
  }[];
  inventory_turnover_days: number;
}

export interface BtlGamificationKpisSummary {
  active_players: number;
  games_started: number;
  games_completed: number;
  completion_rate_percentage: number;
  avg_session_duration_minutes: number;
  rewards_unlocked: number;
  coupons_redeemed: number;
  gamified_sales_revenue: number;
}

export interface AdminDashboardData {
  commercial: CommercialKpisSummary;
  gamification_btl: BtlGamificationKpisSummary;
  machine_learning: {
    demand_forecasts: DemandForecastResult[];
    sales_forecast: SalesForecastResult;
    segments: CustomerSegmentResult[];
  };
  data_engineering: {
    pipelines: DataPipelineStatus[];
    data_quality_score: number; // 0 - 100%
  };
}

// ============================================================================
// 6. CONTRATOS DE LECTURA — DASHBOARD FASE 3.2
// ============================================================================

export interface AnalyticsPeriod { start: string; end: string; timezone: 'UTC'; }
export interface AnalyticsSeriesPoint { date: string; count: number; amount?: number; }
export interface AnalyticsProductMetric { productId: string; name: string; count: number; amount?: number; }
export interface AnalyticsAvailability { available: boolean; reason?: string; }

export interface SalesAnalyticsResponse {
  period: AnalyticsPeriod;
  kpis: { totalOrders: number; nonCancelledOrders: number; simulatedAmount: number; simulatedAverageTicket: number; };
  ordersByStatus: { status: string; count: number; }[];
  timeline: AnalyticsSeriesPoint[];
  topProducts: AnalyticsProductMetric[];
}

export interface CustomersAnalyticsResponse {
  period: AnalyticsPeriod;
  kpis: { registeredCustomers: number; newRegistrations: number; identifiableBuyers: number; recurringIdentifiableBuyers: number; averageOrdersPerIdentifiableBuyer: number; };
  registrations: AnalyticsSeriesPoint[];
  activity: { label: string; buyers: number }[];
  notes: string[];
}

export interface BehaviorAnalyticsResponse {
  period: AnalyticsPeriod;
  kpis: Record<'productViews' | 'searches' | 'filters' | 'cartAdds' | 'checkoutStarts', number>;
  eventsByType: { type: string; events: number; uniqueSessions: number }[];
  timeline: AnalyticsSeriesPoint[];
  topProducts: AnalyticsProductMetric[];
  consentNotice: string;
}

export interface ConversionAnalyticsResponse {
  period: AnalyticsPeriod;
  funnel: { stage: string; count: number; source: 'telemetry' | 'orders' }[];
  sequentialRate: AnalyticsAvailability;
  coupons: { ordersWithCoupon: number; simulatedDiscount: number; couponsUsed: number; byType: { type: string; count: number }[]; };
}

export interface GameAnalyticsResponse {
  period: AnalyticsPeriod;
  kpis: { technicalSessions: number; victories: number; btlCouponsGenerated: number; btlCouponsUsed: number; simulatedAmountWithBtlCoupons: number; };
  victoriesByLevel: { level: number; victories: number }[];
  notes: string[];
}

// Fase 3.3: contratos de lectura agregada para analítica avanzada.
export interface AdvancedComparisonMetric { key: string; label: string; current: number; previous: number; absoluteChange: number; percentageChange: number | null; }
export interface AdvancedComparisonResponse { period: AnalyticsPeriod; previousPeriod: AnalyticsPeriod; metrics: AdvancedComparisonMetric[]; notes: string[]; }
export interface AdvancedSegmentsResponse { period: AnalyticsPeriod; segments: { code: string; description: string; users: number; percentage: number | null; }[]; rfm: { label: string; users: number; }[]; notes: string[]; }
export interface AdvancedProductsResponse { period: AnalyticsPeriod; products: { productId: string; name: string; units: number; orders: number; simulatedLineSubtotal: number; unitShare: number | null; amountShare: number | null; previousUnits: number; unitChange: number; }[]; timeline: AnalyticsSeriesPoint[]; notes: string[]; }
export type AdvancedExportType = 'timeline' | 'products' | 'segments' | 'events';

export type MlDataSource = 'real_commercial' | 'synthetic_academic';
export interface MlManifest { run_id: string; generated_at: string; data_source: MlDataSource; granularity: string; horizon: number; observations: number; products?: number; pipeline_version: string; training_status: 'completed' | 'skipped'; reason: string | null; sufficiency: 'insufficient' | 'exploratory' | 'evaluable'; methodology_version?: string | null; evaluation_protocol?: string | null; }
export interface MlQuality { data_source: MlDataSource; observations: number; products: number; period_start: string | null; period_end: string | null; missing_values: number; duplicates: number; negative_quantities: number; invalid_dates: number; sufficiency: MlManifest['sufficiency']; warnings: string[]; }
export interface MlMetricRow { model: string; mae: number; rmse: number; wape: number | null; bias: number; observations: number; }
export interface MlEvaluation { data_source: MlDataSource; status: string; evaluation_protocol?: string; strategy?: string; horizon?: number; validation_models?: MlMetricRow[]; test_models?: MlMetricRow[]; models: MlMetricRow[]; selected_model: string | null; test_points: { product_id: string; date_utc: string; actual: number; predicted: number; }[]; warnings: string[]; }
export interface MlPredictions { data_source: MlDataSource; status: string; predictions: { product_id: string; horizon: number; estimate: number; model: string; }[]; warnings: string[]; }
