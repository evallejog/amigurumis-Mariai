import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from './common/BrandLogo';
import {
  ShoppingBag,
  Menu,
  X,
  Gamepad2,
  User as UserIcon,
  LogIn,
  LogOut,
  FileText,
  ChevronDown,
  Sparkles,
  ShieldCheck
} from 'lucide-react';

interface NavbarProps {
  activeSection: string;
  onNavigate: (sectionId: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeSection, onNavigate }) => {
  const navigate = useNavigate();
  const { itemCount, setIsCartOpen } = useCart();
  const { user, isAuthenticated, logout, openAuthModal } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const navLinks = [
    { id: 'inicio', label: 'Inicio' },
    { id: 'catalogo', label: 'Colección' },
    { id: 'nosotros', label: 'Filosofía' },
    { id: 'contacto', label: 'Contacto' },
  ];

  const handleLinkClick = (id: string) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full liquid-glass-bar transition-all duration-200 shadow-xs backdrop-blur-2xl bg-white/85">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2 sm:gap-6 h-18">
          {/* Zone 1: Brand Logo */}
          <button
            onClick={() => handleLinkClick('inicio')}
            className="flex items-center min-w-0 shrink cursor-pointer text-left focus:outline-none group"
            aria-label="Ir al inicio de Amigurumis Mariai"
          >
            <BrandLogo size="md" />
          </button>

          {/* Zone 2: Clean Nav Links for Desktop & Laptop (>= 1024px) */}
          <nav className="hidden lg:flex items-center gap-7 text-xs font-bold text-stone-600 font-sans">
            {navLinks.map((link) => {
              const isActive = activeSection === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => handleLinkClick(link.id)}
                  className={`relative py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    isActive
                      ? 'text-stone-950 font-extrabold'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  <span>{link.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-700 rounded-full" />
                  )}
                </button>
              );
            })}

            {/* Minigame Direct Dedicated Screen Link */}
            <button
              onClick={() => navigate('/jugar')}
              className="relative py-1 px-3 rounded-full bg-amber-100/90 text-amber-900 hover:bg-amber-200/90 border border-amber-300/60 font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <Gamepad2 className="w-3.5 h-3.5 text-amber-700" />
              <span>Jugar Pompón</span>
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-stone-950 text-[8px] font-black tracking-wider uppercase">
                PROMO
              </span>
            </button>
          </nav>

          {/* Zone 3: Actions (User Account + Shopping Bag) */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* User Account / Orders Button */}
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="py-1.5 px-3 rounded-xl liquid-glass text-stone-800 hover:text-stone-950 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-stone-200 shadow-xs"
                >
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.fullName || 'Usuario'}
                      className="w-4 h-4 rounded-full object-cover shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <UserIcon className="w-3.5 h-3.5 text-amber-700" />
                  )}
                  <span className="max-w-[100px] truncate hidden sm:inline">
                    {user?.fullName?.split(' ')[0] || 'Cuenta'}
                  </span>
                  <ChevronDown className="w-3 h-3 text-stone-400" />
                </button>

                {/* Dropdown Menu */}
                {userDropdownOpen && (
                  <div
                    className="absolute right-0 mt-2 w-48 rounded-2xl liquid-glass-elevated border border-stone-200 shadow-xl bg-white/95 p-1.5 z-50 animate-fadeIn"
                    onMouseLeave={() => setUserDropdownOpen(false)}
                  >
                    <div className="px-3 py-2 border-b border-stone-100">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-bold text-stone-900 truncate">{user?.fullName}</p>
                        {user?.role === 'admin' && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 font-extrabold text-[9px] uppercase tracking-wider">
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-stone-500 truncate">{user?.email}</p>
                    </div>

                    {user?.role === 'admin' && (
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          navigate('/admin');
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-amber-900 bg-amber-50/80 hover:bg-amber-100/90 flex items-center gap-2 cursor-pointer transition-colors border border-amber-200/60 my-1"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                        <span>Panel Administrador</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        navigate('/compras');
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-stone-700 hover:bg-amber-50 hover:text-amber-900 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Mis Compras (PDF)</span>
                    </button>

                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        logout();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Cerrar Sesión</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => openAuthModal('login')}
                className="py-1.5 px-3 rounded-xl liquid-glass hover:bg-white text-stone-700 hover:text-stone-900 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-stone-200 shadow-xs"
              >
                <LogIn className="w-3.5 h-3.5 text-amber-700" />
                <span className="hidden sm:inline">Mi Cuenta</span>
              </button>
            )}

            {/* Shopping Bag Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative py-2 px-3.5 rounded-xl liquid-glass text-stone-800 hover:text-stone-950 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs border border-white/80 hover:border-amber-400/50"
              aria-label={`Ver bolsa de compras con ${itemCount} artículos`}
            >
              <ShoppingBag className="w-4 h-4 text-stone-700" />
              <span className="hidden sm:inline">Bolsa</span>
              <span className="w-5 h-5 rounded-full bg-stone-900 text-white text-[11px] font-bold flex items-center justify-center tabular-nums shadow-xs">
                {itemCount}
              </span>
            </button>

            {/* Mobile menu toggle for tablet width (768px - 1023px) */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="hidden sm:flex lg:hidden p-2 rounded-xl text-stone-600 hover:text-stone-900 hover:bg-white/60 transition-colors cursor-pointer"
              aria-label="Menú navegación tablet"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Nav Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-4 border-t border-stone-200/50 space-y-1">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => handleLinkClick(link.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                  activeSection === link.id
                    ? 'bg-stone-900 text-white font-bold'
                    : 'text-stone-700 hover:bg-white/60'
                }`}
              >
                {link.label}
              </button>
            ))}

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/jugar');
              }}
              className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold bg-amber-100 text-amber-900 flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Gamepad2 className="w-4 h-4" />
                <span>Jugar Videojuego Pompón</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-stone-950 text-xs font-black">
                PROMO
              </span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
