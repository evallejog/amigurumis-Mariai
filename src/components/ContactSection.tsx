import React, { useState } from 'react';
import { Mail, MapPin, Clock, Send, CheckCircle2 } from 'lucide-react';
import { businessConfig } from '../data/businessConfig';

export const ContactSection: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = formData.name.trim(); const email = formData.email.trim(); const subject = formData.subject.trim(); const message = formData.message.trim();
    if (!name || !email || !subject || !message) { setError('Completa todos los campos obligatorios.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Ingresa un correo electrónico válido.'); return; }
    setSending(true); setError('');
    try {
      const response = await fetch('/api/contact/messages', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, subject, message }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No fue posible enviar el mensaje.');
      setSubmitted(true);
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Error de conexión. Intenta de nuevo.'); }
    finally { setSending(false); }
  };

  return (
    <section id="contacto" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* Left Column: Direct Info & WhatsApp */}
        <div className="lg:col-span-5 space-y-6">
          <div>
            <span className="text-xs font-bold text-amber-800 tracking-wider uppercase block mb-2 font-sans">
              02. Comunicación Directa
            </span>
            <h2 className="text-3xl sm:text-4xl font-sans font-extrabold text-stone-900 tracking-tight">
              Escríbenos y conversemos
            </h2>
            <p className="mt-3 text-stone-600 text-sm sm:text-base font-normal leading-relaxed">
              ¿Tienes una consulta sobre un diseño especial, una combinación de colores o despacho?
              Atendemos personalmente cada consulta con la misma calidez con la que tejemos.
            </p>
          </div>

          {/* Contact details */}
          <div className="liquid-glass-elevated rounded-3xl p-6 border border-white/80 shadow-md space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100/80 text-amber-800 flex items-center justify-center">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-sans font-bold text-stone-900">Canal de consultas</h3>
                <p className="text-xs text-stone-500 font-normal">Las consultas se registran en el panel administrativo.</p>
              </div>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed font-normal">
              Usa el formulario para consultar por diseños, disponibilidad o la experiencia interactiva de Pompón.
            </p>
          </div>

          {/* Details list */}
          <div className="liquid-glass rounded-2xl p-5 border border-white/70 space-y-3.5 text-xs text-stone-700">
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-amber-700 shrink-0" />
              <span>{businessConfig.contact.locationPlaceholder}</span>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-amber-700 shrink-0" />
              <span>{businessConfig.contact.workshopHours}</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Correo de atención por confirmar</span>
            </div>
          </div>
        </div>

        {/* Right Column: Contact Message Form */}
        <div className="lg:col-span-7">
          <div className="liquid-glass-elevated rounded-3xl p-6 sm:p-8 border border-white/80 shadow-xl">
            <h3 className="text-lg font-sans font-bold text-stone-900 mb-1">
              Envíanos un mensaje
            </h3>
            <p className="text-xs text-stone-500 mb-6 font-light">
              Completa el formulario para enviar una consulta. No se envía correo automático.
            </p>

            {submitted ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-stone-900">¡Mensaje Enviado con Éxito!</h4>
                <p className="text-xs text-stone-600 max-w-sm mx-auto">
                  Tu consulta fue registrada y está disponible para revisión administrativa.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5 font-sans">
                      Tu Nombre
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ej. Camila Torres"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/70 border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5 font-sans">Asunto</label>
                    <input type="text" required maxLength={160} value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} placeholder="Ej. Consulta sobre un diseño" className="w-full px-3.5 py-2.5 rounded-xl bg-white/70 border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs" />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5 font-sans">
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="camila@correo.com"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/70 border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5 font-sans">
                    Mensaje o Consulta sobre Diseños
                  </label>
                  <textarea
                    required
                    rows={4}
                    maxLength={4000}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Cuéntanos qué amigurumi te gustaría o qué dudas tienes sobre tu pedido..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/70 border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs"
                  />
                </div>

                {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-800">{error}</p>}

                <button
                  type="submit"
                  disabled={sending}
                  className="w-full py-3 px-4 rounded-xl liquid-btn-primary text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sending ? 'Enviando mensaje…' : 'Enviar mensaje'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
