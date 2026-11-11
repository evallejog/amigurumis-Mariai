/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { CatalogSection } from './components/catalog/CatalogSection';
import { BtlGameSection } from './game/BtlGameSection';
import { AboutSection } from './components/AboutSection';
import { ContactSection } from './components/ContactSection';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/cart/CartDrawer';
import { CheckoutModal } from './components/cart/CheckoutModal';
import { AuthModal } from './components/auth/AuthModal';
import { BottomNavBar } from './components/navigation/BottomNavBar';
import { GamePage } from './pages/GamePage';
import { OrderHistoryPage } from './pages/OrderHistoryPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { Product } from './types';

function MainStoreView() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<string>('inicio');

  // Single source of truth lock for programmatic navigation (prevents indicator flicker)
  const isProgrammaticScrollRef = useRef<boolean>(false);
  const scrollTimeoutRef = useRef<number | null>(null);

  // Smooth scroll handler with robust programmatic lock
  const handleNavigate = (sectionId: string) => {
    const targetId = sectionId === 'personalizar' ? 'juego' : sectionId;

    // 1. Activar inmediatamente el destino sin parpadeos
    setActiveSection(targetId);

    // 2. Bloquear temporalmente el scroll spy para evitar que posiciones intermedias sobreescriban
    isProgrammaticScrollRef.current = true;
    if (scrollTimeoutRef.current) {
      window.clearTimeout(scrollTimeoutRef.current);
    }

    const element = document.getElementById(targetId);
    if (element) {
      // Compensar por la barra sticky superior (80px)
      const yOffset = -80;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    } else if (targetId === 'inicio') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // 3. Liberar el bloqueo cuando el desplazamiento termine
    const unlock = () => {
      isProgrammaticScrollRef.current = false;
    };

    if ('onscrollend' in window) {
      const handleScrollEnd = () => {
        unlock();
        window.removeEventListener('scrollend', handleScrollEnd);
      };
      window.addEventListener('scrollend', handleScrollEnd, { once: true });
    }

    scrollTimeoutRef.current = window.setTimeout(unlock, 800);
  };

  // Desbloquear si el usuario interrumpe con scroll manual (rueda o touch)
  useEffect(() => {
    const handleUserInterrupt = () => {
      isProgrammaticScrollRef.current = false;
    };

    window.addEventListener('wheel', handleUserInterrupt, { passive: true });
    window.addEventListener('touchstart', handleUserInterrupt, { passive: true });

    return () => {
      window.removeEventListener('wheel', handleUserInterrupt);
      window.removeEventListener('touchstart', handleUserInterrupt);
    };
  }, []);

  // WhatsApp inquiry handler for individual products
  const handleInquireProductWhatsApp = (product: Product) => {
    const text = encodeURIComponent(
      `¡Hola Amigurumis Mariai! Estoy visitando la web y me gustaría consultar por el muñeco artesanal "${product.name}" (Ref: ${product.id}). ¿Tienen disponibilidad o cuánto demora su confección?`
    );
    window.open(`https://wa.me/573124567890?text=${text}`, '_blank');
  };

  // Scroll Spy unificado para desplazamiento manual
  useEffect(() => {
    const sections = ['inicio', 'catalogo', 'juego', 'nosotros', 'contacto'];

    const handleScroll = () => {
      if (isProgrammaticScrollRef.current) return;

      const scrollPosition = window.scrollY + 140;

      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 60) {
        setActiveSection('contacto');
        return;
      }

      if (window.scrollY < 80) {
        setActiveSection('inicio');
        return;
      }

      for (const sectionId of sections) {
        const el = document.getElementById(sectionId);
        if (el) {
          const top = el.offsetTop - 100;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(sectionId);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div
      className="min-h-screen bg-[#FAF7F2] text-[#2E2823] font-sans selection:bg-amber-200 selection:text-amber-900 flex flex-col relative pb-16 lg:pb-0"
      style={{ scrollPaddingTop: '5rem' }}
    >
      {/* Sticky Liquid Glass Navigation Bar for PC & Tablet */}
      <Navbar activeSection={activeSection} onNavigate={handleNavigate} />

      {/* Main Content Area */}
      <main className="flex-1">
        {/* Section 1: Hero */}
        <div id="inicio">
          <Hero
            onNavigateToCatalog={() => handleNavigate('catalogo')}
            onNavigateToCustomizer={() => navigate('/jugar')}
          />
        </div>

        {/* Section 2: Catálogo de Productos con Filtros y Disponibilidad */}
        <CatalogSection onInquireWhatsApp={handleInquireProductWhatsApp} />

        {/* Section 3: Minivideojuego BTL "Las Aventuras de Pompón" */}
        <div id="juego" className="contents">
          <BtlGameSection
            onNavigateToCatalog={() => handleNavigate('catalogo')}
          />
        </div>

        {/* Section 4: Filosofía de Confección & Materiales Nobles */}
        <AboutSection />

        {/* Section 5: Contacto Directo, Taller y WhatsApp */}
        <ContactSection />
      </main>

      {/* Modern Bottom Navigation Bar for Mobile and Compact Tablets (< 1024px) */}
      <BottomNavBar
        activeSection={activeSection}
        onNavigate={handleNavigate}
      />

      {/* Footer */}
      <Footer onNavigate={handleNavigate} />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Routes>
            {/* Route 1: Main Store View */}
            <Route path="/" element={<MainStoreView />} />

            {/* Route 2: Dedicated Independent Game Screen */}
            <Route path="/jugar" element={<GamePage />} />

            {/* Route 3: Order History Screen */}
            <Route path="/compras" element={<OrderHistoryPage />} />

            {/* Route 4: Admin Dashboard Screen (Fase 2F.1) */}
            <Route path="/admin" element={<AdminDashboardPage />} />
          </Routes>

          {/* Global Modals & Drawers */}
          <AuthModal />
          <CartDrawer />
          <CheckoutModal />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
