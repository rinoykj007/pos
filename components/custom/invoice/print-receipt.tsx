'use client';

import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Button } from '@/components/ui/button';
import { Download, Printer } from 'lucide-react';
import { InvoiceResponse, OrderItem } from '@/lib/definations';

interface PrintReceiptProps {
  invoice: InvoiceResponse;
  onClose?: () => void;
}

const PrintReceipt = React.forwardRef<HTMLDivElement, PrintReceiptProps>(
  ({ invoice }, ref) => {
    const { invoice: invoiceData, items, order, generatedBy } = invoice;

    return (
      <div
        ref={ref}
        className="w-full bg-white p-8 text-black"
        style={{
          fontFamily: 'Arial, sans-serif',
          fontSize: '14px',
          lineHeight: '1.6',
        }}
      >
        {/* Header */}
        <div className="text-center mb-6 border-b pb-4">
          <h1 className="text-2xl font-bold">Foodya Restaurant</h1>
          <p className="text-sm text-gray-600">Find it, Eat it, Love it</p>
        </div>

        {/* Invoice Title */}
        <div className="text-center mb-4">
          <h2 className="text-lg font-bold">INVOICE #{invoiceData.id}</h2>
        </div>

        {/* Invoice Details */}
        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <p className="font-semibold">Customer Name:</p>
            <p>{invoiceData.customerName || 'N/A'}</p>
          </div>
          <div>
            <p className="font-semibold">Order Type:</p>
            <p className="uppercase">{order?.orderType?.replace('_', ' ') || 'N/A'}</p>
          </div>
          <div>
            <p className="font-semibold">Payment Method:</p>
            <p className="capitalize">{invoiceData.paymentMethod || 'N/A'}</p>
          </div>
          <div>
            <p className="font-semibold">Invoice Date:</p>
            <p>{new Date(invoiceData.createdAt).toLocaleDateString()}</p>
          </div>
          {invoiceData.generatedByUserId && (
            <div className="col-span-2">
              <p className="font-semibold">Invoiced by:</p>
              <p>{generatedBy?.name || 'N/A'}</p>
            </div>
          )}
        </div>

        {/* Items Table */}
        <div className="mb-6 border-t border-b py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b font-semibold">
                <th className="text-left py-2">Item</th>
                <th className="text-center py-2">Qty</th>
                <th className="text-right py-2">Price</th>
                <th className="text-right py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {items?.map((item: OrderItem, index: number) => (
                <tr key={index} className="border-b py-2">
                  <td className="py-2">
                    <div>{item.menuItemName}</div>
                    {item.menuItemOptionName && (
                      <div className="text-xs text-gray-600">({item.menuItemOptionName})</div>
                    )}
                  </td>
                  <td className="text-center py-2">{item.quantity}</td>
                  <td className="text-right py-2 whitespace-nowrap">
                    PKR {parseFloat(item.price).toFixed(2)}
                  </td>
                  <td className="text-right py-2 whitespace-nowrap">
                    PKR {(parseFloat(item.price) * item.quantity).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mb-6 space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span className="font-semibold">
              PKR {parseFloat(invoiceData.subTotalAmount || '0').toFixed(2)}
            </span>
          </div>
          {parseFloat(invoiceData.discount || '0') > 0 && (
            <div className="flex justify-between">
              <span>Discount:</span>
              <span className="font-semibold">
                {invoiceData.discount}%
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Total:</span>
            <span className="font-semibold">
              PKR {parseFloat(invoiceData.totalAmount || '0').toFixed(2)}
            </span>
          </div>
          {parseFloat(invoiceData.advancePaid || '0') > 0 && (
            <div className="flex justify-between">
              <span>Advance Paid:</span>
              <span className="font-semibold">
                PKR {parseFloat(invoiceData.advancePaid || '0').toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 text-base font-bold">
            <span>Grand Total:</span>
            <span>PKR {parseFloat(invoiceData.grandTotal || '0').toFixed(2)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center border-t pt-4 text-xs text-gray-600">
          <p>Thank you for your purchase!</p>
          <p>Please visit again.</p>
        </div>
      </div>
    );
  }
);

PrintReceipt.displayName = 'PrintReceipt';

export function PrintReceiptDialog({ invoice, onClose }: PrintReceiptProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle: `Invoice_${invoice.invoice.id}`,
    pageStyle: `
      @page {
        size: A4;
        margin: 0.5in;
      }
      @media print {
        body {
          margin: 0;
          padding: 0;
        }
      }
    `,
  });

  const handleDownloadPDF = () => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 10;
    let yPosition = margin;

    const { invoice: invoiceData, items } = invoice;
    const invoiceId = invoiceData?.id ?? 'Unknown';
    const customerName = invoiceData?.customerName ?? 'N/A';
    const orderType = invoice.order?.orderType?.replace('_', ' ').toUpperCase() ?? 'N/A';
    const paymentMethod = invoiceData?.paymentMethod ?? 'N/A';
    const createdAt = invoiceData?.createdAt ?? new Date();
    const subTotal = invoiceData?.subTotalAmount ?? '0';
    const discount = invoiceData?.discount ?? '0';
    const total = invoiceData?.totalAmount ?? '0';
    const advancePaid = invoiceData?.advancePaid ?? '0';
    const grandTotal = invoiceData?.grandTotal ?? '0';

    // Title
    pdf.setFontSize(16);
    pdf.text('Foodya Restaurant', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 6;

    pdf.setFontSize(10);
    pdf.text('Find it, Eat it, Love it', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;

    // Invoice number
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'bold');
    pdf.text(`INVOICE #${invoiceId}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;

    // Invoice details
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Customer: ${customerName}`, margin, yPosition);
    yPosition += 5;
    pdf.text(`Order Type: ${orderType}`, margin, yPosition);
    yPosition += 5;
    pdf.text(`Payment: ${paymentMethod}`, margin, yPosition);
    yPosition += 5;
    pdf.text(`Date: ${new Date(createdAt).toLocaleDateString()}`, margin, yPosition);
    yPosition += 8;

    // Items table
    const tableData = items?.map((item: OrderItem, index: number) => [
      (index + 1).toString(),
      item.menuItemName + (item.menuItemOptionName ? ` (${item.menuItemOptionName})` : ''),
      item.quantity.toString(),
      parseFloat(item.price).toFixed(2),
      (parseFloat(item.price) * item.quantity).toFixed(2),
    ]) || [];

    autoTable(pdf, {
      startY: yPosition,
      head: [['#', 'Item', 'Qty', 'Price', 'Total']],
      body: tableData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9 },
      headStyles: { fillColor: [200, 200, 200], textColor: 0 },
    });

    yPosition = (pdf as any).lastAutoTable.finalY + 5;

    // Totals
    pdf.setFont(undefined, 'bold');
    pdf.text(`Subtotal: PKR ${parseFloat(subTotal).toFixed(2)}`, pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 5;

    if (parseFloat(discount) > 0) {
      pdf.text(`Discount: ${discount}%`, pageWidth - margin, yPosition, { align: 'right' });
      yPosition += 5;
    }

    pdf.text(`Total: PKR ${parseFloat(total).toFixed(2)}`, pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 5;

    if (parseFloat(advancePaid) > 0) {
      pdf.text(`Advance: PKR ${parseFloat(advancePaid).toFixed(2)}`, pageWidth - margin, yPosition, { align: 'right' });
      yPosition += 5;
    }

    pdf.setFontSize(11);
    pdf.text(`Grand Total: PKR ${parseFloat(grandTotal).toFixed(2)}`, pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 8;

    // Footer
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'normal');
    pdf.text('Thank you for your purchase!', pageWidth / 2, pdf.internal.pageSize.getHeight() - 10, { align: 'center' });

    pdf.save(`Invoice_${invoiceId}.pdf`);
  };

  return (
    <div className="w-full space-y-4">
      <PrintReceipt ref={contentRef} invoice={invoice} onClose={onClose} />

      <div className="flex gap-2 justify-center print:hidden">
        <Button
          onClick={() => handlePrint()}
          className="flex items-center gap-2"
          variant="default"
        >
          <Printer className="w-4 h-4" />
          Print Receipt
        </Button>
        <Button
          onClick={handleDownloadPDF}
          className="flex items-center gap-2"
          variant="secondary"
        >
          <Download className="w-4 h-4" />
          Download PDF
        </Button>
      </div>
    </div>
  );
}

export default PrintReceipt;
