import { useState } from 'react';
import { setAnalyticsConsent } from '../../analytics/client';

export function AnalyticsConsent() {
  const [visible, setVisible] = useState(() => {
    try { return localStorage.getItem('amigurumis_mariai_analytics_consent_v1') === null; } catch { return false; }
  });
  if (!visible) return null;
  const choose = (granted: boolean) => { setAnalyticsConsent(granted); setVisible(false); };
  return <aside role="dialog" aria-label="Preferencias de analítica" className="fixed bottom-3 left-3 right-3 z-[100] mx-auto max-w-xl rounded-2xl border border-stone-200 bg-white p-4 shadow-xl">
    <p className="text-sm text-stone-700">¿Permites el registro anónimo de navegación y uso del catálogo para fines académicos? Puedes rechazarlo; los pedidos simulados siguen funcionando.</p>
    <div className="mt-3 flex gap-2"><button className="rounded-lg bg-stone-900 px-3 py-2 text-xs font-semibold text-white" onClick={() => choose(true)}>Aceptar analítica</button><button className="rounded-lg border px-3 py-2 text-xs" onClick={() => choose(false)}>Rechazar</button></div>
  </aside>;
}
