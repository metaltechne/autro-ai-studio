import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { AggregatedPart } from '../../types';
import { Textarea } from './Textarea';

interface EmailReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectionSummary: {
    selectedBrand: string;
    selectedModel: string;
    totalValue: number;
    uniqueModels: number;
  };
  aggregatedParts: AggregatedPart[];
  totalAggregatedValue: number;
}

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Function to generate the email body text
const generateEmailBody = (summary: EmailReportModalProps['selectionSummary'], parts: AggregatedPart[], totalValue: number): string => {
  const brandTitle = summary.selectedBrand;
  const modelTitle = summary.selectedModel || 'Todos os Modelos';

  let body = `Olá,\n\nSegue o relatório de componentes agregados para a frota ${brandTitle} - ${modelTitle}.\n\n`;
  body += `========================================\n`;
  body += `RESUMO\n`;
  body += `========================================\n`;
  body += `- Valor Total da Frota: ${formatCurrency(summary.totalValue)}\n`;
  body += `- Modelos Únicos na Seleção: ${summary.uniqueModels}\n`;
  body += `- Valor Total das Peças Agregadas: ${formatCurrency(totalValue)}\n\n`;
  
  body += `========================================\n`;
  body += `PEÇAS NECESSÁRIAS\n`;
  body += `========================================\n`;

  parts.forEach(part => {
    body += `- ${part.totalQuantity}x ${part.name} (SKU: ${part.sku}) - Valor Total: ${formatCurrency(part.totalValue)}\n`;
  });

  body += `\n\nAtenciosamente,\nSistema AUTRO`;

  return body;
};

export const EmailReportModal: React.FC<EmailReportModalProps> = ({ 
    isOpen, 
    onClose, 
    selectionSummary, 
    aggregatedParts, 
    totalAggregatedValue 
}) => {
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    if (isOpen) {
      const brand = selectionSummary.selectedBrand;
      const model = selectionSummary.selectedModel || 'Todos';
      const date = new Date().toLocaleDateString('pt-BR');
      
      setSubject(`Relatório de Frota AUTRO: ${brand} (${model}) - ${date}`);
      setBody(generateEmailBody(selectionSummary, aggregatedParts, totalAggregatedValue));
    }
  }, [isOpen, selectionSummary, aggregatedParts, totalAggregatedValue]);

  const handleSend = () => {
    if (!recipient) {
      alert('Por favor, insira um destinatário.');
      return;
    }
    const mailtoLink = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Enviar Relatório por Email">
      <div className="space-y-4">
        <Input
          label="Destinatário"
          type="email"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="email@exemplo.com"
          required
        />
        <Input
          label="Assunto"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
        />
        <Textarea
          label="Corpo do Email"
          id="email-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
        />
      </div>
      <div className="flex justify-end pt-6 mt-4 border-t gap-2">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSend}>Abrir no Cliente de Email</Button>
      </div>
    </Modal>
  );
};