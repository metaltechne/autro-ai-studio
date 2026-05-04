import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Kit, Component } from '../../types';
import { getLogoBase64ForPdf } from '../../data/assets';
import { savePdfResiliently } from './pdfDownloadHelper';

export const generateQuotePDF = async (
    clientName: string,
    title: string,
    items: { kit: Kit | Component | undefined; quantity: number; price: number }[],
    totalValue: number,
    taxValue: number = 0,
    shippingValue: number = 0,
    taxDetails: { name: string; value: number }[] = [],
    vehicleDetails: { description: string; code: string; keyCount: number }[] = []
) => {
    try {
        const doc = new jsPDF();
        
        try {
            const logoBase64 = await getLogoBase64ForPdf();
            if (logoBase64) {
                doc.addImage(logoBase64, 'JPEG', 14, 12, 40, 10);
            }
        } catch (error) {
            console.error("Could not load logo for PDF:", error);
        }

        doc.setFontSize(18);
        doc.setTextColor(40);
        doc.setFont('helvetica', 'normal');
        doc.text("Orçamento de Venda", 200, 22, { align: 'right' });

        doc.setDrawColor('#002B8A');
        doc.line(14, 28, 200, 28);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Cliente: ${clientName}`, 14, 38);
        doc.text(`Título: ${title || 'Orçamento de Peças'}`, 14, 43);
        doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 48);
        
        let startY = 55;
        if (vehicleDetails && vehicleDetails.length > 0) {
            doc.setFontSize(10);
            doc.setTextColor(40);
            doc.setFont('helvetica', 'bold');
            doc.text("Veículos / Equipamentos:", 14, 58);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100);
            
            vehicleDetails.forEach((v, idx) => {
                const text = `${v.description}${v.code ? ` (Cód: ${v.code})` : ''} - ${v.keyCount} Chave(s)`;
                doc.text(text, 14, 63 + (idx * 5));
            });
            startY = 63 + (vehicleDetails.length * 5) + 5;
        }
        
        const formatBRL = (val: any) => {
            const num = Number(val) || 0;
            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
        };

        const tableData = items.map(item => {
            if (!item.kit) return [];
            const itemPrice = Number(item.price) || 0;
            return [
                item.quantity || 0,
                item.kit.sku || '',
                item.kit.name || '',
                formatBRL(itemPrice),
                formatBRL(itemPrice * (item.quantity || 0))
            ];
        }).filter(row => row.length > 0);
        
        autoTable(doc, {
            startY: startY,
            head: [['Qtd', 'SKU', 'Descrição', 'Valor Unit.', 'Total']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [0, 43, 138] },
            styles: { fontSize: 9 }
        });
        
        const finalY = (doc as any).lastAutoTable.finalY || startY;
        let currentY = finalY + 10;

        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.setFont('helvetica', 'normal');

        // Display tax breakdown
        if (taxDetails && taxDetails.length > 0) {
            taxDetails.forEach(tax => {
                doc.text(`${tax.name}: ${formatBRL(tax.value)}`, 200, currentY, { align: 'right' });
                currentY += 5;
            });
        } else if (taxValue > 0) {
            doc.text(`Impostos: ${formatBRL(taxValue)}`, 200, currentY, { align: 'right' });
            currentY += 5;
        }

        if (shippingValue > 0) {
            doc.text(`Frete: ${formatBRL(shippingValue)}`, 200, currentY, { align: 'right' });
            currentY += 5;
        }

        doc.setFontSize(14);
        doc.setTextColor(40);
        doc.setFont('helvetica', 'bold');
        doc.text(`Valor Total: ${formatBRL(totalValue)}`, 200, currentY + 5, { align: 'right' });
        
        const pageCount = (doc as any).internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(150);
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.text(`Orçamento gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, doc.internal.pageSize.height - 10);
            doc.text(`Página ${i} de ${pageCount}`, 200, doc.internal.pageSize.height - 10, { align: 'right' });
        }

        savePdfResiliently(doc, `Orcamento_${clientName.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
        return true;
    } catch (error) {
        console.error("Error generating PDF:", error);
        throw error;
    }
};
