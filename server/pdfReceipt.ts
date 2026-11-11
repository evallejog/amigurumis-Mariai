import PDFDocument from 'pdfkit';
import { Response } from 'express';

export interface OrderPdfData {
  orderNumber: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  customerCity: string;
  customerApartment?: string;
  shippingMethod: string;
  paymentMethod: string;
  subtotal: number;
  shippingCost: number;
  discount: number;
  couponCode?: string;
  total: number;
  status: string;
  isSimulated?: boolean;
  items: {
    productName: string;
    quantity: number;
    price: number;
  }[];
}

export function generateOrderPdf(order: OrderPdfData, res: Response) {
  const doc = new PDFDocument({
    margin: 48,
    size: 'A4',
    info: {
      Title: `Comprobante Simulado - ${order.orderNumber} - Amigurumis Mariai`,
      Author: 'Amigurumis Mariai (Demostración Académica)',
      Subject: 'Comprobante de Pedido Simulado - Modo Demo Académico',
    },
  });

  // Pipe to response
  doc.pipe(res);

  // Colors
  const darkBrown = '#2E2823';
  const warmAmber = '#C87D55';
  const lightBeige = '#F5EBE1';
  const textMuted = '#6B7280';
  const greenStatus = '#166534';
  const demoAlertRed = '#991B1B';

  // 1. Header Banner
  doc
    .rect(48, 40, doc.page.width - 96, 68)
    .fill(lightBeige);

  // Logo / Title
  doc
    .fillColor(warmAmber)
    .fontSize(19)
    .font('Helvetica-Bold')
    .text('Amigurumis Mariai', 64, 48);

  doc
    .fillColor(darkBrown)
    .fontSize(8.5)
    .font('Helvetica')
    .text('Arte y Muñecos Tejidos a Mano en Crochet · Colombia', 64, 70);

  doc
    .fillColor(demoAlertRed)
    .fontSize(7.5)
    .font('Helvetica-Bold')
    .text('MODO DEMOSTRACIÓN ACADÉMICA · PAGO SIMULADO (SIN COBRO REAL)', 64, 84);

  // Right side header info
  doc
    .fillColor(darkBrown)
    .fontSize(11)
    .font('Helvetica-Bold')
    .text('COMPROBANTE SIMULADO', doc.page.width - 240, 48, { align: 'right', width: 176 });

  doc
    .fillColor(warmAmber)
    .fontSize(9.5)
    .font('Helvetica-Bold')
    .text(`#${order.orderNumber}`, doc.page.width - 240, 64, { align: 'right', width: 176 });

  doc
    .fillColor(textMuted)
    .fontSize(8)
    .font('Helvetica')
    .text(`Fecha: ${new Date(order.createdAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}`, doc.page.width - 240, 78, { align: 'right', width: 176 });

  // 2. Customer & Shipping details cards
  let y = 126;

  // Box Left: Cliente
  doc
    .rect(48, y, (doc.page.width - 108) / 2, 88)
    .lineWidth(0.8)
    .strokeColor('#E5E7EB')
    .fillAndStroke('#FFFFFF', '#E5E7EB');

  doc
    .fillColor(warmAmber)
    .fontSize(9)
    .font('Helvetica-Bold')
    .text('DATOS DEL COMPRADOR', 60, y + 10);

  doc
    .fillColor(darkBrown)
    .fontSize(9)
    .font('Helvetica')
    .text(`Nombre: ${order.customerName}`, 60, y + 26)
    .text(`Email: ${order.customerEmail}`, 60, y + 40)
    .text(`Teléfono / WhatsApp: ${order.customerPhone}`, 60, y + 54)
    .text(`Ciudad: ${order.customerCity}`, 60, y + 68);

  // Box Right: Envío y Entrega
  const rightBoxX = 48 + (doc.page.width - 108) / 2 + 12;
  doc
    .rect(rightBoxX, y, (doc.page.width - 108) / 2, 88)
    .lineWidth(0.8)
    .strokeColor('#E5E7EB')
    .fillAndStroke('#FFFFFF', '#E5E7EB');

  doc
    .fillColor(warmAmber)
    .fontSize(9)
    .font('Helvetica-Bold')
    .text('DIRECCIÓN DE ENTREGA & ESTADO', rightBoxX + 12, y + 10);

  doc
    .fillColor(darkBrown)
    .fontSize(9)
    .font('Helvetica')
    .text(`Dirección: ${order.customerAddress}`, rightBoxX + 12, y + 26)
    .text(`Detalle: ${order.customerApartment || 'Sin observaciones'}`, rightBoxX + 12, y + 40)
    .text(`Método: Envío ${order.shippingMethod === 'express' ? 'Express Nacional' : order.shippingMethod === 'pickup' ? 'Coordinación con Taller' : 'Estándar Nacional'}`, rightBoxX + 12, y + 54);

  // Status pill
  doc
    .fillColor(greenStatus)
    .font('Helvetica-Bold')
    .text(`Estado: ${order.status.replace(/_/g, ' ').toUpperCase()}`, rightBoxX + 12, y + 68);

  // 3. Items Table
  y += 106;

  // Table Header
  doc
    .rect(48, y, doc.page.width - 96, 22)
    .fill('#2E2823');

  doc
    .fillColor('#FFFFFF')
    .fontSize(9)
    .font('Helvetica-Bold')
    .text('PRODUCTO / ARTÍCULO ARTESANAL', 60, y + 6)
    .text('CANT.', doc.page.width - 240, y + 6, { width: 50, align: 'center' })
    .text('PRECIO UNIT.', doc.page.width - 180, y + 6, { width: 60, align: 'right' })
    .text('TOTAL', doc.page.width - 110, y + 6, { width: 50, align: 'right' });

  y += 22;

  // Table Rows
  order.items.forEach((item, index) => {
    const rowBg = index % 2 === 0 ? '#FFFFFF' : '#FAF7F2';
    doc
      .rect(48, y, doc.page.width - 96, 24)
      .fill(rowBg);

    doc
      .fillColor(darkBrown)
      .fontSize(9)
      .font('Helvetica')
      .text(item.productName, 60, y + 7, { width: doc.page.width - 310, ellipsis: true })
      .text(`${item.quantity}`, doc.page.width - 240, y + 7, { width: 50, align: 'center' })
      .text(`$ ${item.price.toLocaleString('es-CO')}`, doc.page.width - 180, y + 7, { width: 60, align: 'right' })
      .font('Helvetica-Bold')
      .text(`$ ${(item.price * item.quantity).toLocaleString('es-CO')}`, doc.page.width - 110, y + 7, { width: 50, align: 'right' });

    y += 24;
  });

  // 4. Financial Summary
  y += 14;

  const summaryX = doc.page.width - 250;
  const summaryWidth = 202;

  doc
    .rect(summaryX, y, summaryWidth, 90)
    .lineWidth(0.8)
    .strokeColor('#E5E7EB')
    .fillAndStroke('#FAF7F2', '#E5E7EB');

  doc
    .fillColor(textMuted)
    .fontSize(9)
    .font('Helvetica')
    .text('Subtotal artículos:', summaryX + 12, y + 10)
    .fillColor(darkBrown)
    .text(`$ ${order.subtotal.toLocaleString('es-CO')} COP`, summaryX + 12, y + 10, { width: summaryWidth - 24, align: 'right' });

  doc
    .fillColor(textMuted)
    .text('Costo de envío:', summaryX + 12, y + 26)
    .fillColor(darkBrown)
    .text(`$ ${order.shippingCost.toLocaleString('es-CO')} COP`, summaryX + 12, y + 26, { width: summaryWidth - 24, align: 'right' });

  if (order.discount > 0) {
    const couponLabel = order.couponCode ? `Descuento BTL (${order.couponCode}):` : 'Descuento BTL:';
    doc
      .fillColor(warmAmber)
      .text(couponLabel, summaryX + 12, y + 42)
      .text(`-$ ${order.discount.toLocaleString('es-CO')} COP`, summaryX + 12, y + 42, { width: summaryWidth - 24, align: 'right' });
  }

  // Total line
  doc
    .moveTo(summaryX + 12, y + 58)
    .lineTo(summaryX + summaryWidth - 12, y + 58)
    .lineWidth(1)
    .strokeColor('#D1D5DB');

  doc
    .fillColor(darkBrown)
    .fontSize(11)
    .font('Helvetica-Bold')
    .text('TOTAL:', summaryX + 12, y + 66)
    .fillColor(warmAmber)
    .text(`$ ${order.total.toLocaleString('es-CO')} COP`, summaryX + 12, y + 66, { width: summaryWidth - 24, align: 'right' });

  // 5. Legal & Artisan Disclaimer Note
  const footerY = doc.page.height - 110;
  doc
    .rect(48, footerY, doc.page.width - 96, 62)
    .lineWidth(0.6)
    .strokeColor('#E5E7EB')
    .fillAndStroke('#FFFFFF', '#E5E7EB');

  doc
    .fillColor(warmAmber)
    .fontSize(8)
    .font('Helvetica-Bold')
    .text('AVISO DE COMPROBANTE SIMULADO · DEMOSTRACIÓN ACADÉMICA:', 60, footerY + 8);

  doc
    .fillColor(textMuted)
    .fontSize(7.5)
    .font('Helvetica')
    .text(
      'Este documento constituye un comprobante y resumen de pedido simulado generado en el marco de la demostración académica de la plataforma Amigurumis Mariai. No existe procesamiento bancario real, pago con dinero verdadero ni emisión de factura electrónica ante la Dirección de Impuestos y Aduanas Nacionales (DIAN) de Colombia. Esta orden tiene fines pedagógicos y evaluativos de arquitectura de software.',
      60,
      footerY + 20,
      { width: doc.page.width - 120, lineGap: 2 }
    );

  // End the document
  doc.end();
}
