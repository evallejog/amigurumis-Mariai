import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { AnalyticsFilters } from './analytics/AnalyticsFilters';
import { AnalyticsNavigation, type AnalyticsModule } from './analytics/AnalyticsNavigation';
import { AnalyticsOverview } from './analytics/AnalyticsOverview';
import { SalesAnalytics } from './analytics/SalesAnalytics';
import { CustomersAnalytics } from './analytics/CustomersAnalytics';
import { BehaviorAnalytics } from './analytics/BehaviorAnalytics';
import { ConversionAnalytics } from './analytics/ConversionAnalytics';
import { GameAnalytics } from './analytics/GameAnalytics';
import { AdvancedAnalytics } from './analytics/AdvancedAnalytics';

type StandardModule = Exclude<AnalyticsModule, 'overview' | 'advanced'>;
const moduleKeys: Record<StandardModule, string> = { sales:'sales', customers:'customers', behavior:'behavior', conversion:'conversion', game:'game' };
const overviewKeys = Object.keys(moduleKeys) as StandardModule[];

export function AnalyticsDashboard() {
  const requestInit: RequestInit = { credentials: 'same-origin' };
  const [active, setActive] = useState<AnalyticsModule>('overview');
  const [period, setPeriod] = useState('30'); const [custom, setCustom] = useState(false); const [start, setStart] = useState(''); const [end, setEnd] = useState('');
  const [cache, setCache] = useState<Record<string, any>>({}); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);
  const query = useMemo(() => custom ? `start=${start}&end=${end}` : `period=${period}`, [custom,start,end,period]);
  const cacheKey = `${query}:`; const required: StandardModule[] = active === 'overview' ? overviewKeys : active === 'advanced' ? [] : [active];
  const load = useCallback(async (force = false) => { if (custom && (!start || !end)) { setError('Selecciona las dos fechas UTC.'); return; } const missing = force ? required : required.filter(key => !cache[`${cacheKey}${moduleKeys[key]}`]); if (!missing.length) return; setLoading(true); setError(''); try { const results = await Promise.all(missing.map(async key => { const endpoint = moduleKeys[key]; const response = await fetch(`/api/admin/analytics/${endpoint}?${query}`, requestInit); const json = await response.json(); if (!response.ok) throw new Error(json.error || 'No fue posible cargar las estadísticas.'); return [`${cacheKey}${endpoint}`, json] as const; })); setCache(previous => ({ ...previous, ...Object.fromEntries(results) })); } catch (err:any) { setError(err.message || 'Error de conexión.'); } finally { setLoading(false); } }, [cache, cacheKey, custom, query, required, start, end]);
  useEffect(() => { void load(); }, [active, period]);
  const data = (name: string) => cache[`${cacheKey}${name}`]; const allReady = required.every(key => data(moduleKeys[key]));
  const content = () => { if (active === 'advanced') return <AdvancedAnalytics query={query} refreshTick={refreshTick}/>; if (!allReady) return <div className="min-h-[320px] py-20 text-center text-sm font-semibold text-stone-500">{loading ? 'Cargando datos agregados…' : 'Selecciona un periodo y actualiza las estadísticas.'}</div>; if (active === 'overview') return <AnalyticsOverview data={{ sales:data('sales'), customers:data('customers'), behavior:data('behavior'), conversion:data('conversion'), game:data('game') }} onNavigate={setActive}/>; if (active === 'sales') return <SalesAnalytics data={data('sales')}/>; if (active === 'customers') return <CustomersAnalytics data={data('customers')}/>; if (active === 'behavior') return <BehaviorAnalytics data={data('behavior')}/>; if (active === 'conversion') return <ConversionAnalytics data={data('conversion')}/>; return <GameAnalytics data={data('game')}/>; };
  return <div className="space-y-4"><AnalyticsFilters period={period} custom={custom} start={start} end={end} loading={loading} onPeriod={setPeriod} onCustom={setCustom} onStart={setStart} onEnd={setEnd} onRefresh={() => { setRefreshTick(value=>value+1); void load(true); }}/><AnalyticsNavigation active={active} onChange={setActive}/>{error && <div role="alert" className="flex gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-800"><AlertCircle className="h-4 w-4 shrink-0"/>{error}</div>}<main aria-live="polite" className="min-h-[440px]">{content()}</main></div>;
}
