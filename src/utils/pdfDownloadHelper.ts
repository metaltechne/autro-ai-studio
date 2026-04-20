
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';

/**
 * Robustly saves a jsPDF document using a Blob and file-saver.
 * This approach is more reliable in many browser environments, 
 * especially when working inside iframes or with strict security policies.
 */
export const savePdfResiliently = (doc: jsPDF, filename: string) => {
  const finalFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  try {
    // For AI Studio Build environment, doc.save() is generally the most reliable 
    // as it triggers a direct download link which is handled by the browser.
    console.log(`Attempting to save PDF: ${finalFilename}`);
    doc.save(finalFilename);
    console.log('PDF saved successfully via doc.save()');
  } catch (error) {
    console.error('Error saving PDF with doc.save, trying file-saver:', error);
    try {
      const pdfBlob = doc.output('blob');
      saveAs(pdfBlob, finalFilename);
      console.log('PDF saved successfully via file-saver (Blob)');
    } catch (innerError) {
      console.error('File-saver fallback failed, trying Blob URL in new window:', innerError);
      try {
        const pdfBlob = doc.output('blob');
        const blobUrl = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = finalFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        console.log('PDF download triggered via anchor tag and Blob URL');
      } catch (lastError) {
        console.error('Every single PDF download method failed:', lastError);
        alert('Não foi possível realizar o download automático. O PDF foi gerado, mas o seu navegador bloqueou o download. Verifique as configurações de pop-ups.');
      }
    }
  }
};
