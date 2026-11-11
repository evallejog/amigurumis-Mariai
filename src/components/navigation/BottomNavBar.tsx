import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  ShoppingBag,
  Gamepad2,
  Menu,
  X,
  MessageCircle,
  Info,
  PhoneCall,
  FileText,
  User as UserIcon,
  Sparkles
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { BrandLogo } from '../common/BrandLogo';

interface BottomNavBarProps {
  activeSection: string;
  onNavigate: (sectionId: string) => void;
  isGameActive?: boolean;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeSection,
  onNavigate,
  isGameActive = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { itemCount, setIsCartOpen } = useCart();
  const { user, isAuthenticated, openAuthModal } = useAuth();
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);

  // If currently on dedicated game route /jugar, hide BottomNavBar so player has full screen
  if (location.pathname === '/jugar' || isGameActive) {
    return null;
  }

  const handleNavClick = (sectionId: string) => {
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => onNavigate(sectionId), 100);
    } else {
      onNavigate(sectionId);
    }
    setIsMoreSheetOpen(false);
  };

  const navItems = [
    {
      id: 'inicio',
      label: 'Inicio',
      icon: Home,
      action: () => handleNavClick('inicio'),
      isActive: location.pathname === '/' && activeSection === 'inicio',
    },
    {
      id: 'catalogo',
      label: 'Colección',
      icon: ShoppingBag,
      action: () => handleNavClick('catalogo'),
      isActive: location.pathname === '/' && activeSection === 'catalogo',
    },
    {
      id: 'juego',
      label: 'Jugar',
      icon: Gamepad2,
      badge: 'PROMO',
      action: () => {
        setIsMoreSheetOpen(false);
        navigate('/jugar');
      },
      isActive: location.pathname === '/jugar',
    },
  ];

  const isMoreActive =
    location.pathname === '/compras' ||
    activeSection === 'nosotros' ||
    activeSection === 'contacto' ||
    isMoreSheetOpen;

  return (
    <>
      {/* Bottom Sheet Backdrop for "Más" (More) */}
      {isMoreSheetOpen && (
        <div
          className="fixed inset-0 bg-stone-950/40 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={() => setIsMoreSheetOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Bottom Sheet Drawer for "Más" options */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 lg:hidden transform transition-transform duration-300 ease-out ${
          isMoreSheetOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        role="dialog"
        aria-label="Menú adicional de navegación"
      >
        <div className="liquid-glass border-t border-white/60 rounded-t-3xl p-5 shadow-2xl space-y-4 pb-8 max-w-lg mx-auto bg-stone-100/95 backdrop-blur-xl">
          <div className="flex items-center justify-between pb-2 border-b border-stone-200/50">
            <BrandLogo size="sm" />
            <button
              onClick={() => setIsMoreSheetOpen(false)}
              className="p-1.5 rounded-full text-stone-500 hover:text-stone-900 hover:bg-stone-200/50 cursor-pointer"
              aria-label="Cerrar menú adicional"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => handleNavClick('nosotros')}
              className={`flex items-center gap-3 p-3.5 rounded-2xl text-left border shadow-xs transition-all cursor-pointer ${
                activeSection === 'nosotros' && location.pathname === '/'
                  ? 'bg-amber-50/90 border-amber-300 text-amber-950 ring-1 ring-amber-400/40'
                  : 'bg-white/70 hover:bg-white text-stone-800 border-white/80'
              }`}
            >
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-800 flex items-center justify-center shrink-0">
                <Info className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold font-sans">Filosofía</div>
                <div className="text-[10px] text-stone-500 font-normal">Técnica artesanal</div>
              </div>
            </button>

            <button
              onClick={() => handleNavClick('contacto')}
              className={`flex items-center gap-3 p-3.5 rounded-2xl text-left border shadow-xs transition-all cursor-pointer ${
                activeSection === 'contacto' && location.pathname === '/'
                  ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 ring-1 ring-emerald-400/40'
                  : 'bg-white/70 hover:bg-white text-stone-800 border-white/80'
              }`}
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-800 flex items-center justify-center shrink-0">
                <MessageCircle className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold font-sans">Contacto</div>
                <div className="text-[10px] text-stone-500 font-normal">Taller en Colombia</div>
              </div>
            </button>

            {/* Mis Compras Link */}
            <button
              onClick={() => {
                setIsMoreSheetOpen(false);
                navigate('/compras');
              }}
              className={`flex items-center gap-3 p-3.5 rounded-2xl text-left border shadow-xs transition-all cursor-pointer ${
                location.pathname === '/compras'
                  ? 'bg-amber-50/90 border-amber-300 text-amber-950 ring-1 ring-amber-400/40'
                  : 'bg-white/70 hover:bg-white text-stone-800 border-white/80'
              }`}
            >
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-800 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold font-sans">Mis Compras</div>
                <div className="text-[10px] text-stone-500 font-normal">Comprobantes PDF</div>
              </div>
            </button>

            {/* Mi Cuenta Button */}
            <button
              onClick={() => {
                setIsMoreSheetOpen(false);
                if (isAuthenticated) {
                  navigate('/compras');
                } else {
                  openAuthModal('login');
                }
              }}
              className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/70 hover:bg-white text-stone-800 text-left border border-white/80 shadow-xs transition-all cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-800 flex items-center justify-center shrink-0">
                <UserIcon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold font-sans">
                  {isAuthenticated ? 'Mi Cuenta' : 'Iniciar Sesión'}
                </div>
                <div className="text-[10px] text-stone-500 font-normal truncate max-w-[90px]">
                  {isAuthenticated ? user?.fullName?.split(' ')[0] : 'Ingresar'}
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                setIsMoreSheetOpen(false);
                setIsCartOpen(true);
              }}
              className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/70 hover:bg-white text-stone-800 text-left border border-white/80 shadow-xs transition-all cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-800 flex items-center justify-center shrink-0 relative">
                <ShoppingBag className="w-4 h-4" />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-stone-900 text-white text-[9px] font-bold flex items-center justify-center">
                    {itemCount}
                  </span>
                )}
              </div>
              <div>
                <div className="text-xs font-bold font-sans">Bolsa de Compra</div>
                <div className="text-[10px] text-stone-500 font-normal">{itemCount} items guardados</div>
              </div>
            </button>

            <button
              onClick={() => {
                setIsMoreSheetOpen(false);
                const text = encodeURIComponent('¡Hola Amigurumis Mariai! Me gustaría consultar por muñecos tejidos a crochet y despachos en Colombia.');
                window.open(`https://wa.me/573124567890?text=${text}`, '_blank');
              }}
              className="flex items-center gap-3 p-3.5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-900 text-left border border-emerald-500/20 shadow-xs transition-all cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <PhoneCall className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold font-sans">WhatsApp Directo</div>
                <div className="text-[10px] text-emerald-700 font-normal">+57 312 456 7890</div>
              </div>
            </button>
          </div>

          <div className="p-3 rounded-2xl bg-amber-50/90 border border-amber-200/60 text-[11px] text-amber-900 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Videojuego Pompón Activo</p>
              <p className="text-amber-800/80 text-[10px] font-normal">
                Juega con Pompón en /jugar para obtener hasta 15% de beneficio promocional en tu orden.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Fixed Bottom Navigation Bar (< 1024px) */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 lg:hidden liquid-glass-bar border-t border-white/60 shadow-lg px-2 pt-1 pb-safe backdrop-blur-2xl bg-white/85"
        aria-label="Navegación principal inferior"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-md mx-auto grid grid-cols-4 items-center h-15">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.isActive;
            return (
              <button
                key={item.id}
                onClick={item.action}
                className={`flex flex-col items-center justify-center h-full min-h-[44px] min-w-[44px] transition-all cursor-pointer relative ${
                  isActive ? 'text-stone-950 font-bold scale-105' : 'text-stone-500 hover:text-stone-800'
                }`}
                aria-label={item.label}
              >
                <div className="relative flex flex-col items-center">
                  {item.badge && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-1.5 py-[0.5px] rounded-full bg-amber-500 text-stone-950 text-[7px] font-black tracking-tighter uppercase shadow-xs leading-none whitespace-nowrap">
                      {item.badge}
                    </span>
                  )}
                  <Icon className={`w-5 h-5 transition-transform ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                </div>
                <span className="text-[10px] mt-1 tracking-tight font-sans">{item.label}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-700 mt-0.5" />
                )}
              </button>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setIsMoreSheetOpen(!isMoreSheetOpen)}
            className={`flex flex-col items-center justify-center h-full min-h-[44px] min-w-[44px] transition-all cursor-pointer relative ${
              isMoreActive ? 'text-stone-950 font-bold scale-105' : 'text-stone-500 hover:text-stone-800'
            }`}
            aria-label="Más opciones"
          >
            <Menu className="w-5 h-5 stroke-2" />
            <span className="text-[10px] mt-1 tracking-tight font-sans">Más</span>
            {isMoreActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-700 mt-0.5" />
            )}
          </button>
        </div>
      </nav>
    </>
  );
};
