import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
export interface PdfExportOptions {
  fileName?: string;
  onProgress?: (stage: string) => void;
}

export async function exportReportToPdf(
  elementId: string,
  mode: 'HIRARC' | 'L2B',
  title: string,
  options: PdfExportOptions = {}
): Promise<{ success: boolean; blob?: Blob; error?: string }> {
  try {
    if (options.onProgress) options.onProgress('Menyediakan dokumen untuk ditangkap...');

    const targetElement = document.getElementById(elementId);
    if (!targetElement) {
      throw new Error(`Elemen cetakan #${elementId} tidak dijumpai dalam dokumen.`);
    }

    // Temporarily make element visible for html2canvas capture if it's hidden in media print
    const originalDisplay = targetElement.style.display;
    const originalPosition = targetElement.style.position;
    const originalLeft = targetElement.style.left;
    const originalTop = targetElement.style.top;
    const originalWidth = targetElement.style.width;
    const originalZIndex = targetElement.style.zIndex;

    targetElement.style.display = 'block';
    targetElement.style.position = 'fixed';
    targetElement.style.left = '0';
    targetElement.style.top = '0';
    targetElement.style.width = mode === 'HIRARC' ? '1120px' : '820px';
    targetElement.style.backgroundColor = '#ffffff';
    targetElement.style.zIndex = '99999';

    if (options.onProgress) options.onProgress('Merender halaman ke kanvas beresolusi tinggi...');

    // Small delay to ensure all fonts and DOM styles compute
    await new Promise((resolve) => setTimeout(resolve, 150));

    const canvas = await html2canvas(targetElement, {
      scale: 2, // 2x for sharp printing quality
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: mode === 'HIRARC' ? 1200 : 850
    });

    // Restore original styles
    targetElement.style.display = originalDisplay;
    targetElement.style.position = originalPosition;
    targetElement.style.left = originalLeft;
    targetElement.style.top = originalTop;
    targetElement.style.width = originalWidth;
    targetElement.style.zIndex = originalZIndex;

    if (options.onProgress) options.onProgress('Menjana fail PDF dengan jsPDF...');

    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    const isLandscape = mode === 'HIRARC';
    const orientation = isLandscape ? 'landscape' : 'portrait';
    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const pdfWidth = isLandscape ? 297 : 210;
    const pdfHeight = isLandscape ? 210 : 297;

    const imgWidth = pdfWidth - 16; // 8mm margins on left & right
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const xOffset = 8;
    const yOffset = 8;

    pdf.addImage(imgData, 'JPEG', xOffset, yOffset, imgWidth, Math.min(imgHeight, pdfHeight - 16));

    const sanitizedTitle = (title || 'Borang_Keselamatan_JKM')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 50);
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = options.fileName || `${mode === 'HIRARC' ? 'HIRARC_PK-06' : 'Lampiran_2B'}_${sanitizedTitle}_${dateStr}.pdf`;

    // Download to client browser
    pdf.save(fileName);

    const blob = pdf.output('blob');

    if (options.onProgress) options.onProgress('PDF berjaya dijana dan disimpan!');

    return { success: true, blob };
  } catch (error: any) {
    console.error('PDF export error:', error);
    return {
      success: false,
      error: error && error.message ? error.message : String(error)
    };
  }
}
