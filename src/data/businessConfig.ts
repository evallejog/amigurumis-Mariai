import { BusinessConfig, CategoryOption } from '../types';

/**
 * CONFIGURACIÓN GENERAL DEL EMPRENDIMIENTO
 * Marca definitiva: Amigurumis Mariai (Colombia)
 */
export const businessConfig: BusinessConfig = {
  brandName: 'Amigurumis Mariai',
  provisionalTag: '',
  tagline: 'Muñecos y figuras tejidas a mano punto a punto mediante la técnica tradicional de crochet',
  aboutText: `En Amigurumis Mariai damos vida a piezas únicas hechas a mano con dedicación, ternura y precisión artesanal. 
Cada muñeco es confeccionado punto a punto con hilos seleccionados de alta suavidad, buscando llevar calidez y alegría 
a hogares en toda Colombia, ya sea para decoración, colección o como un regalo inolvidable.`,
  craftPhilosophy: `Nuestras creaciones se trabajan a mano con materiales y acabados que pueden variar según el diseño.
Consulta la ficha de cada pieza para conocer su composición y recomendaciones de cuidado.`,
  contact: {
    whatsappNumberPlaceholder: '+57 312 456 7890',
    whatsappDisplayText: 'Atención por WhatsApp (Colombia)',
    emailPlaceholder: 'contacto@amigurumismariai.com',
    locationPlaceholder: 'Ubicación del taller por confirmar',
    workshopHours: 'Horario de atención por confirmar',
    instagramPlaceholder: '@amigurumis_mariai_co',
  },
};

export const categories: CategoryOption[] = [
  {
    id: 'todos',
    name: 'Todos los productos',
    description: 'Catálogo completo de figuras tejidas a crochet',
  },
  {
    id: 'animales',
    name: 'Animales del Bosque y Granja',
    description: 'Osos, zorros, conejos y fauna en amigurumi',
  },
  {
    id: 'fantasia',
    name: 'Fantasía y Cuentos',
    description: 'Dragones, criaturas mágicas y duendes artesanales',
  },
  {
    id: 'marinos',
    name: 'Vida Marina',
    description: 'Ballenas, pulpos, caballitos de mar y fauna acuática',
  },
  {
    id: 'botanica',
    name: 'Botánica y Llaveros',
    description: 'Cactus, suculentas en maceta tejida y detalles portátiles',
  },
];
