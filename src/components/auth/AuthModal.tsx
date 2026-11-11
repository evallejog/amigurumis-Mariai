import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { BrandLogo } from '../common/BrandLogo';
import {
  X,
  Lock,
  Mail,
  User as UserIcon,
  Phone,
  MapPin,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  LogIn,
  UserPlus
} from 'lucide-react';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    authModalTab,
    closeAuthModal,
    openAuthModal,
    login,
    register,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Bogotá D.C.');
  const [department, setDepartment] = useState('Cundinamarca');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isAuthModalOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (!result.success) {
      setErrorMessage(result.error || 'Credenciales inválidas');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);
    const result = await register({
      email,
      password,
      fullName,
      phone,
      address,
      city,
      department,
    });
    setLoading(false);
    if (!result.success) {
      setErrorMessage(result.error || 'Error al crear la cuenta');
    }
  };

  const handleFillDemoUser = () => {
    setEmail('maria@amigurumismariai.com');
    setPassword('Mariai2026!');
    setErrorMessage(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-md liquid-glass-elevated rounded-3xl p-6 sm:p-8 border border-white/80 shadow-2xl bg-[#FAF7F2]/95 backdrop-blur-2xl">
        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 p-2 rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-200/50 transition-colors cursor-pointer"
          aria-label="Cerrar modal de autenticación"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Header */}
        <div className="text-center mb-6">
          <BrandLogo size="md" className="justify-center mb-3" />
          <h3 className="text-lg font-sans font-bold text-stone-900">
            {authModalTab === 'login' ? 'Bienvenido a tu Cuenta' : 'Crea tu Cuenta Artesanal'}
          </h3>
          <p className="text-xs text-stone-600 mt-1">
            {authModalTab === 'login'
              ? 'Accede para gestionar tus compras, pedidos y beneficios exclusivos.'
              : 'Registra tus datos de envío en Colombia para agilizar tus compras.'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-stone-200/60 mb-5">
          <button
            type="button"
            onClick={() => {
              setErrorMessage(null);
              openAuthModal('login');
            }}
            className={`py-2 text-xs font-bold font-sans rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              authModalTab === 'login'
                ? 'bg-white text-stone-950 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Iniciar Sesión</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setErrorMessage(null);
              openAuthModal('register');
            }}
            className={`py-2 text-xs font-bold font-sans rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              authModalTab === 'register'
                ? 'bg-white text-stone-950 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Registrarse</span>
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* LOGIN FORM */}
        {authModalTab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold font-sans text-stone-700 mb-1">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/80 border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold font-sans text-stone-700 mb-1">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/80 border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl liquid-btn-primary text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-60"
            >
              {loading ? (
                <span>Ingresando...</span>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Ingresar a mi cuenta</span>
                </>
              )}
            </button>

            {/* Quick Demo Access */}
            <div className="pt-2 border-t border-stone-200/60">
              <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200/60 text-xs text-amber-900 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-700 shrink-0" />
                  <div>
                    <p className="font-bold">Cuenta de demostración</p>
                    <p className="text-[11px] text-amber-800">maria@amigurumismariai.com</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleFillDemoUser}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-700 text-white font-bold text-[11px] hover:bg-amber-800 cursor-pointer shadow-xs"
                >
                  Cargar Demo
                </button>
              </div>
            </div>
          </form>
        )}

        {/* REGISTER FORM */}
        {authModalTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            <div>
              <label className="block text-xs font-bold font-sans text-stone-700 mb-1">
                Nombre Completo *
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ej. María Gómez"
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/80 border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold font-sans text-stone-700 mb-1">
                  Correo Electrónico *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="w-full pl-10 pr-3 py-2 rounded-xl bg-white/80 border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold font-sans text-stone-700 mb-1">
                  Teléfono (WhatsApp)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="312 000 0000"
                    className="w-full pl-10 pr-3 py-2 rounded-xl bg-white/80 border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold font-sans text-stone-700 mb-1">
                Contraseña (mínimo 6 caracteres) *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/80 border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold font-sans text-stone-700 mb-1">
                Dirección de Envío (Colombia)
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Calle 123 # 45-67 Apto 101"
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/80 border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold font-sans text-stone-700 mb-1">
                  Ciudad
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Bogotá D.C."
                  className="w-full px-3 py-2 rounded-xl bg-white/80 border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-bold font-sans text-stone-700 mb-1">
                  Departamento
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Cundinamarca"
                  className="w-full px-3 py-2 rounded-xl bg-white/80 border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 py-3 px-4 rounded-xl liquid-btn-primary text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-60"
            >
              {loading ? (
                <span>Creando cuenta...</span>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Crear mi Cuenta</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
