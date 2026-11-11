import React, { useState } from 'react';
import { MessageCircle, Mail, MapPin, Clock, Send, CheckCircle2 } from 'lucide-react';
import { businessConfig } from '../data/businessConfig';

export const ContactSection: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) return;

    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormData({ name: '', email: '', message: '' });
    }, 4000);
  };

  const handleOpenWhatsApp = () => {
    const text = encodeURIComponent('¡Hola Amigurumis Mariai! Me gustaría hacer una consulta sobre los amigurumis artesanales, tiempos de confección y despachos en Colombia.');
    window.open(`https://wa.me/573124567890?text=${text}`, '_blank');
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

          {/* Quick WhatsApp Card */}
          <div className="liquid-glass-elevated rounded-3xl p-6 border border-white/80 shadow-md space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-sans font-bold text-stone-900">Atención Directa en Colombia</h3>
                <p className="text-xs text-stone-500 font-normal">{businessConfig.contact.workshopHours}</p>
              </div>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed font-normal">
              Envíanos fotos de referencia, dudas sobre el videojuego de Pompón o consultas de disponibilidad para entrega inmediata.
            </p>
            <button
              onClick={handleOpenWhatsApp}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Abrir Conversación en WhatsApp ({businessConfig.contact.whatsappNumberPlaceholder})</span>
            </button>
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
              <span>{businessConfig.contact.emailPlaceholder}</span>
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
              Completa el formulario y nos contactaremos a la brevedad.
            </p>

            {submitted ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-stone-900">¡Mensaje Enviado con Éxito!</h4>
                <p className="text-xs text-stone-600 max-w-sm mx-auto">
                  Gracias por escribirnos. María y el equipo de Amigurumis Mariai te responderán prontamente.
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
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Cuéntanos qué amigurumi te gustaría o qué dudas tienes sobre tu pedido..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/70 border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-xl liquid-btn-primary text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar Mensaje al Taller</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
