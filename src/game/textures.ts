import Phaser from 'phaser';

/**
 * Generador procedural de texturas artesanales para "Las Aventuras de Pompón".
 * Genera gráficos vectoriales nítidos con textura de punto de crochet,
 * tela de fieltro, ovillos de lana y herramientas de costura.
 */
export function generateGameTextures(scene: Phaser.Scene) {
  const textures = scene.textures;

  // 1. POMPÓN (PROTAGONISTA - REPOSO / CARRERA)
  if (!textures.exists('pompon')) {
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 46;
    const ctx = canvas.getContext('2d')!;

    // Orejas de fieltro
    ctx.fillStyle = '#F5EBE1';
    ctx.strokeStyle = '#D6C7B8';
    ctx.lineWidth = 1.5;

    // Oreja izquierda
    ctx.beginPath();
    ctx.ellipse(14, 11, 4.5, 10, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Oreja derecha
    ctx.beginPath();
    ctx.ellipse(26, 11, 4.5, 10, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Interior rosado de orejas
    ctx.fillStyle = '#E8B4B8';
    ctx.beginPath();
    ctx.ellipse(14, 11, 2.5, 6, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(26, 11, 2.5, 6, 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Cuerpo / Cabeza de algodón amigurumi (círculo crochet suave)
    ctx.fillStyle = '#FAF7F2';
    ctx.strokeStyle = '#D6C7B8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(20, 26, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Textura sutil de puntadas de crochet
    ctx.strokeStyle = '#EBE1D5';
    ctx.lineWidth = 1;
    for (let r = 8; r <= 12; r += 3) {
      ctx.beginPath();
      ctx.arc(20, 26, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Ojos de seguridad (arandelas plásticas brillantes)
    ctx.fillStyle = '#2B2623';
    ctx.beginPath();
    ctx.arc(15, 24, 2.5, 0, Math.PI * 2);
    ctx.arc(25, 24, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Brillo en los ojos
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(14, 23, 0.9, 0, Math.PI * 2);
    ctx.arc(24, 23, 0.9, 0, Math.PI * 2);
    ctx.fill();

    // Hocico y nariz bordada
    ctx.fillStyle = '#C87D55';
    ctx.beginPath();
    ctx.moveTo(19, 27);
    ctx.lineTo(21, 27);
    ctx.lineTo(20, 29);
    ctx.closePath();
    ctx.fill();

    // Mejillas rosadas bordadas
    ctx.fillStyle = 'rgba(232, 180, 184, 0.6)';
    ctx.beginPath();
    ctx.arc(12, 28, 2.2, 0, Math.PI * 2);
    ctx.arc(28, 28, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Bufanda mostaza tejida
    ctx.fillStyle = '#D89F68';
    ctx.strokeStyle = '#B88048';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(11, 34, 18, 6, 3);
    ctx.fill();
    ctx.stroke();

    // Flecos de bufanda
    ctx.beginPath();
    ctx.moveTo(25, 39);
    ctx.lineTo(29, 44);
    ctx.lineTo(27, 45);
    ctx.lineTo(23, 40);
    ctx.fill();
    ctx.stroke();

    // Patitas acolchadas
    ctx.fillStyle = '#F5EBE1';
    ctx.beginPath();
    ctx.ellipse(14, 43, 3.5, 2.5, 0, 0, Math.PI * 2);
    ctx.ellipse(26, 43, 3.5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    textures.addCanvas('pompon', canvas);
  }

  // 2. OVILLO DE LANA (COLECCIONABLE)
  if (!textures.exists('wool-ball')) {
    const canvas = document.createElement('canvas');
    canvas.width = 24;
    canvas.height = 24;
    const ctx = canvas.getContext('2d')!;

    // Sombra suave
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.ellipse(12, 21, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bola de lana coral/ámbar
    ctx.fillStyle = '#C87D55';
    ctx.strokeStyle = '#A8603B';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(12, 11, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Hebras de lana enrolladas en cruz
    ctx.strokeStyle = '#F3D2BA';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(12, 11, 6, -0.6, 1.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(12, 11, 7, 2.1, 4.2);
    ctx.stroke();

    // Hebra suelta que cae con lazo
    ctx.strokeStyle = '#C87D55';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(17, 16);
    ctx.quadraticCurveTo(22, 18, 20, 23);
    ctx.stroke();

    textures.addCanvas('wool-ball', canvas);
  }

  // 3. BOTÓN DE MADERA (COLECCIONABLE BONUS)
  if (!textures.exists('button-wood')) {
    const canvas = document.createElement('canvas');
    canvas.width = 22;
    canvas.height = 22;
    const ctx = canvas.getContext('2d')!;

    // Cuerpo del botón
    ctx.fillStyle = '#D9A464';
    ctx.strokeStyle = '#9E6A30';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(11, 11, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Borde interno repujado
    ctx.strokeStyle = '#B88246';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(11, 11, 6.5, 0, Math.PI * 2);
    ctx.stroke();

    // 4 agujeritos
    ctx.fillStyle = '#5C3810';
    ctx.beginPath();
    ctx.arc(9, 9, 1.2, 0, Math.PI * 2);
    ctx.arc(13, 9, 1.2, 0, Math.PI * 2);
    ctx.arc(9, 13, 1.2, 0, Math.PI * 2);
    ctx.arc(13, 13, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Hilo cruzado en el centro
    ctx.strokeStyle = '#FAF7F2';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(9, 9);
    ctx.lineTo(13, 13);
    ctx.moveTo(13, 9);
    ctx.lineTo(9, 13);
    ctx.stroke();

    textures.addCanvas('button-wood', canvas);
  }

  // 4. PLATAFORMAS DE TELA DE FIELTRO MODULARES (SIN DISTORSIÓN DE ESCALA)
  const drawFeltPlatformCanvas = (width: number, height: number): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const pad = 2;
    const innerW = width - pad * 2;
    const innerH = height - 6;

    // Sombra suave acolchada inferior
    ctx.fillStyle = 'rgba(38, 50, 36, 0.16)';
    ctx.beginPath();
    ctx.roundRect(pad + 2, pad + 5, innerW - 4, innerH, 8);
    ctx.fill();

    // Base de tejido de fieltro grueso verde salvia artesanal
    ctx.fillStyle = '#6E8F66';
    ctx.strokeStyle = '#4E6F48';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(pad, pad, innerW, innerH, 8);
    ctx.fill();
    ctx.stroke();

    // Cojín de volumen superior (relieve de lana prensada y luz)
    const bevelGrad = ctx.createLinearGradient(0, pad, 0, pad + 12);
    bevelGrad.addColorStop(0, '#98BA90');
    bevelGrad.addColorStop(1, '#6E8F66');
    ctx.fillStyle = bevelGrad;
    ctx.beginPath();
    ctx.roundRect(pad + 1.5, pad + 1.5, innerW - 3, 11, [7, 7, 3, 3]);
    ctx.fill();

    // Textura orgánica de fieltrado con aguja (fibras de lana)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    for (let x = pad + 6; x < width - pad - 6; x += 11) {
      const y1 = pad + 3 + ((x * 7) % 6);
      ctx.fillRect(x, y1, 2, 1.5);
    }
    ctx.fillStyle = 'rgba(40, 60, 40, 0.15)';
    for (let x = pad + 10; x < width - pad - 10; x += 14) {
      const y2 = pad + 12 + ((x * 5) % 8);
      ctx.fillRect(x, y2, 2, 1.5);
    }

    // Cadeneta continua de puntos de crochet en el borde superior (espaciado uniforme 12px)
    ctx.strokeStyle = '#FAF7F2';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    for (let x = pad + 10; x <= width - pad - 10; x += 12) {
      ctx.beginPath();
      ctx.arc(x, pad + 5, 3.2, 0, Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, pad + 4, 1.4, 0, Math.PI);
      ctx.stroke();
    }

    // Bordado con puntadas de cruz 'X' auténticas en la franja media/inferior
    ctx.strokeStyle = '#FAF7F2';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    const stitchY = pad + innerH - 7;
    for (let x = pad + 14; x <= width - pad - 14; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x - 3, stitchY - 3);
      ctx.lineTo(x + 3, stitchY + 3);
      ctx.moveTo(x + 3, stitchY - 3);
      ctx.lineTo(x - 3, stitchY + 3);
      ctx.stroke();
    }

    // Remate y nudo artesanal en los 4 vértices
    ctx.fillStyle = '#E8D8C8';
    ctx.strokeStyle = '#FAF7F2';
    ctx.lineWidth = 1;
    const corners = [
      [pad + 8, pad + 8],
      [width - pad - 8, pad + 8],
      [pad + 8, pad + innerH - 7],
      [width - pad - 8, pad + innerH - 7],
    ];
    corners.forEach(([cx, cy]) => {
      ctx.beginPath();
      ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    return canvas;
  };

  // Suelo segmentado artesanal (380x80) con estratos de lana y césped de crochet
  const drawGroundPlatformCanvas = (width: number, height: number): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Sombra base
    ctx.fillStyle = 'rgba(25, 35, 25, 0.2)';
    ctx.fillRect(4, 8, width - 8, height - 8);

    // Estrato textil inferior (tierra de fieltro cálido tostado)
    const earthGrad = ctx.createLinearGradient(0, 18, 0, height);
    earthGrad.addColorStop(0, '#7A5B44');
    earthGrad.addColorStop(0.5, '#624531');
    earthGrad.addColorStop(1, '#4A3323');
    ctx.fillStyle = earthGrad;
    ctx.beginPath();
    ctx.roundRect(0, 18, width, height - 18, [0, 0, 10, 10]);
    ctx.fill();

    // Trama de costura diagonal de soporte en la tierra
    ctx.strokeStyle = 'rgba(250, 247, 242, 0.18)';
    ctx.lineWidth = 1.2;
    for (let x = -height; x < width + height; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, 24);
      ctx.lineTo(x + 36, height);
      ctx.stroke();
    }

    // Capa de césped de lana verde musgo
    const grassGrad = ctx.createLinearGradient(0, 0, 0, 24);
    grassGrad.addColorStop(0, '#8CAE84');
    grassGrad.addColorStop(0.5, '#6E9266');
    grassGrad.addColorStop(1, '#53754B');
    ctx.fillStyle = grassGrad;
    ctx.beginPath();
    ctx.roundRect(0, 0, width, 24, [8, 8, 4, 4]);
    ctx.fill();

    // Cadena de puntadas de crochet en la superficie
    ctx.strokeStyle = '#FAF7F2';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    for (let x = 10; x <= width - 10; x += 12) {
      ctx.beginPath();
      ctx.arc(x, 5, 3.2, 0, Math.PI);
      ctx.stroke();
    }

    // Pespunte decorativo de costura mostaza
    ctx.strokeStyle = '#D9A464';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(8, 21);
    ctx.lineTo(width - 8, 21);
    ctx.stroke();
    ctx.setLineDash([]);

    return canvas;
  };

  // Plataforma deshilachada de alta precisión para Nivel 3
  const drawFrayedPlatformCanvas = (width: number, height: number): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const pad = 2;
    const innerW = width - pad * 2;
    const innerH = height - 10;

    // Sombra suave
    ctx.fillStyle = 'rgba(45, 25, 20, 0.15)';
    ctx.beginPath();
    ctx.roundRect(pad + 2, pad + 4, innerW - 4, innerH, 6);
    ctx.fill();

    // Base terracota rústica
    ctx.fillStyle = '#B46A4D';
    ctx.strokeStyle = '#8B4830';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(pad, pad, innerW, innerH, 7);
    ctx.fill();
    ctx.stroke();

    // Cadeneta superior de crochet
    ctx.strokeStyle = '#E29A7D';
    ctx.lineWidth = 1.5;
    for (let x = pad + 10; x < width - pad - 6; x += 12) {
      ctx.beginPath();
      ctx.arc(x, pad + 5, 3, 0, Math.PI);
      ctx.stroke();
    }

    // Pespunte de refuerzo central
    ctx.strokeStyle = '#FAF7F2';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pad + 8, pad + 14);
    ctx.lineTo(width - pad - 8, pad + 14);
    ctx.stroke();
    ctx.setLineDash([]);

    // Hebras deshilachadas que cuelgan del borde inferior
    ctx.strokeStyle = '#D48669';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    let idx = 0;
    for (let hx = pad + 12; hx < width - pad - 10; hx += 16) {
      const hy = innerH + pad + 2 + (idx % 3) * 3;
      ctx.beginPath();
      ctx.moveTo(hx, innerH + pad);
      ctx.quadraticCurveTo(hx + (idx % 2 === 0 ? 3 : -3), hy - 2, hx, hy);
      ctx.stroke();
      idx++;
    }

    return canvas;
  };

  if (!textures.exists('platform-felt-180')) {
    textures.addCanvas('platform-felt-180', drawFeltPlatformCanvas(180, 32));
  }
  if (!textures.exists('platform-felt-270')) {
    textures.addCanvas('platform-felt-270', drawFeltPlatformCanvas(270, 32));
  }
  if (!textures.exists('platform-felt')) {
    textures.addCanvas('platform-felt', drawFeltPlatformCanvas(180, 32));
  }
  if (!textures.exists('platform-ground-380')) {
    textures.addCanvas('platform-ground-380', drawGroundPlatformCanvas(380, 80));
  }
  if (!textures.exists('platform-frayed-90')) {
    textures.addCanvas('platform-frayed-90', drawFrayedPlatformCanvas(90, 36));
  }
  if (!textures.exists('platform-frayed-180')) {
    textures.addCanvas('platform-frayed-180', drawFrayedPlatformCanvas(180, 36));
  }
  if (!textures.exists('platform-frayed')) {
    textures.addCanvas('platform-frayed', drawFrayedPlatformCanvas(180, 36));
  }

  // 5. PLATAFORMA CINTA MÉTRICA MÓVIL ARTESANAL
  if (!textures.exists('platform-tape')) {
    const canvas = document.createElement('canvas');
    canvas.width = 110;
    canvas.height = 26;
    const ctx = canvas.getContext('2d')!;

    // Sombra sutil
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.beginPath();
    ctx.roundRect(3, 6, 104, 18, 4);
    ctx.fill();

    // Cinta de sastre amarillo clásico satinado
    const grad = ctx.createLinearGradient(0, 2, 0, 22);
    grad.addColorStop(0, '#FDE68A');
    grad.addColorStop(0.5, '#F5D36E');
    grad.addColorStop(1, '#EAB308');

    ctx.fillStyle = grad;
    ctx.strokeStyle = '#B4881A';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(2, 2, 106, 20, 4);
    ctx.fill();
    ctx.stroke();

    // Pespunte superior e inferior de costura de cinta
    ctx.strokeStyle = '#A16207';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(10, 4);
    ctx.lineTo(100, 4);
    ctx.moveTo(10, 20);
    ctx.lineTo(100, 20);
    ctx.stroke();
    ctx.setLineDash([]);

    // Graduaciones milimétricas y de centímetros
    ctx.fillStyle = '#292524';
    let cmNumber = 1;
    for (let x = 12; x < 98; x += 4) {
      const isCm = (x - 12) % 16 === 0;
      const isHalfCm = (x - 12) % 8 === 0 && !isCm;

      if (isCm) {
        ctx.fillRect(x, 2, 1.8, 9);
        // Número de centímetro
        ctx.font = 'bold 7px sans-serif';
        ctx.fillText(cmNumber.toString(), x - 2, 18);
        cmNumber++;
      } else if (isHalfCm) {
        ctx.fillRect(x, 2, 1.2, 6);
      } else {
        ctx.fillRect(x, 2, 1, 3.5);
      }
    }

    // Remate metálico de latón/bronce en los extremos (conector de sastre)
    ctx.fillStyle = '#CA8A04';
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 1;
    // Extremo izquierdo
    ctx.beginPath();
    ctx.roundRect(2, 2, 7, 20, 2);
    ctx.fill();
    ctx.stroke();
    // Remache izquierdo
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(5, 12, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Extremo derecho
    ctx.fillStyle = '#CA8A04';
    ctx.beginPath();
    ctx.roundRect(101, 2, 7, 20, 2);
    ctx.fill();
    ctx.stroke();
    // Remache derecho
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(104, 12, 1.5, 0, Math.PI * 2);
    ctx.fill();

    textures.addCanvas('platform-tape', canvas);
  }

  // 6. PELIGRO: ALFILER CON CABEZA DE PERLA DE JOYERÍA
  if (!textures.exists('pin-hazard')) {
    const canvas = document.createElement('canvas');
    canvas.width = 22;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;

    // Punta metálica acerada con bisel
    const needleGrad = ctx.createLinearGradient(10, 10, 13, 30);
    needleGrad.addColorStop(0, '#E2E8F0');
    needleGrad.addColorStop(0.5, '#CBD5E1');
    needleGrad.addColorStop(1, '#64748B');

    ctx.strokeStyle = needleGrad;
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(11, 29);
    ctx.lineTo(11, 10);
    ctx.stroke();

    // Punta aguda
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(11, 29);
    ctx.lineTo(11, 31);
    ctx.stroke();

    // Cabeza de perla roja cereza con sombreado esférico
    const pearlGrad = ctx.createRadialGradient(9, 7, 1, 11, 9, 7);
    pearlGrad.addColorStop(0, '#F87171');
    pearlGrad.addColorStop(0.4, '#DC2626');
    pearlGrad.addColorStop(1, '#7F1D1D');

    ctx.fillStyle = pearlGrad;
    ctx.strokeStyle = '#991B1B';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(11, 9, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Brillo especular perlado de luz
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(8.5, 6.5, 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(13.5, 11.5, 1, 0, Math.PI * 2);
    ctx.fill();

    textures.addCanvas('pin-hazard', canvas);
  }

  // 7. PELIGRO: TIJERAS DE COSTURA VINTAGE
  if (!textures.exists('scissor-hazard')) {
    const canvas = document.createElement('canvas');
    canvas.width = 34;
    canvas.height = 38;
    const ctx = canvas.getContext('2d')!;

    // Hojas de acero afiladas
    ctx.fillStyle = '#E2E8F0';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;

    // Hoja izquierda
    ctx.beginPath();
    ctx.moveTo(17, 17);
    ctx.lineTo(7, 2);
    ctx.lineTo(12, 17);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Hoja derecha
    ctx.beginPath();
    ctx.moveTo(17, 17);
    ctx.lineTo(27, 2);
    ctx.lineTo(22, 17);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Filo brillante en el borde
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(16, 16);
    ctx.lineTo(8, 3);
    ctx.moveTo(18, 16);
    ctx.lineTo(26, 3);
    ctx.stroke();

    // Remache central dorado
    ctx.fillStyle = '#CA8A04';
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(17, 17, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Anillas de mango doradas estilo bordado europeo
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.ellipse(11, 28, 5.5, 6.5, -0.2, 0, Math.PI * 2);
    ctx.ellipse(23, 28, 5.5, 6.5, 0.2, 0, Math.PI * 2);
    ctx.stroke();

    textures.addCanvas('scissor-hazard', canvas);
  }

  // 8. PELUSA TRAVIESA (ENEMIGO SUAVE)
  if (!textures.exists('dust-bunny')) {
    const canvas = document.createElement('canvas');
    canvas.width = 28;
    canvas.height = 24;
    const ctx = canvas.getContext('2d')!;

    // Pelusa nubosa lila/gris
    ctx.fillStyle = '#A78BFA';
    ctx.strokeStyle = '#7C3AED';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.arc(8, 14, 6, 0, Math.PI * 2);
    ctx.arc(14, 11, 8, 0, Math.PI * 2);
    ctx.arc(20, 14, 6, 0, Math.PI * 2);
    ctx.arc(14, 16, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Ojitos saltones
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(11, 10, 2.5, 0, Math.PI * 2);
    ctx.arc(17, 10, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Pupilas
    ctx.fillStyle = '#1E1B4B';
    ctx.beginPath();
    ctx.arc(12, 10, 1.2, 0, Math.PI * 2);
    ctx.arc(18, 10, 1.2, 0, Math.PI * 2);
    ctx.fill();

    textures.addCanvas('dust-bunny', canvas);
  }

  // 9. META: CANASTO DE COSTURA CON MADEJAS
  if (!textures.exists('goal-basket')) {
    const canvas = document.createElement('canvas');
    canvas.width = 44;
    canvas.height = 42;
    const ctx = canvas.getContext('2d')!;

    // Canasto de mimbre marrón
    ctx.fillStyle = '#B45309';
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(6, 18);
    ctx.lineTo(38, 18);
    ctx.lineTo(33, 40);
    ctx.lineTo(11, 40);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Trama entrecruzada de mimbre
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 1.2;
    for (let y = 22; y <= 36; y += 4) {
      ctx.beginPath();
      ctx.moveTo(8, y);
      ctx.lineTo(36, y);
      ctx.stroke();
    }

    // Madejas coloridas sobresaliendo del canasto
    ctx.fillStyle = '#EC4899'; // Rosa
    ctx.beginPath();
    ctx.arc(14, 14, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#06B6D4'; // Turquesa
    ctx.beginPath();
    ctx.arc(24, 11, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#F59E0B'; // Dorado
    ctx.beginPath();
    ctx.arc(32, 14, 6, 0, Math.PI * 2);
    ctx.fill();

    // Aguja de tejer clavada con perla
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(12, 4);
    ctx.lineTo(30, 28);
    ctx.stroke();

    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(11, 3, 3, 0, Math.PI * 2);
    ctx.fill();

    textures.addCanvas('goal-basket', canvas);
  }
}
