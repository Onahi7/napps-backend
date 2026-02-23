/**
 * Generate PDF Receipt with NAPPS Logo
 * Uses the actual logo file and generates a professional receipt
 */

const fs = require('fs');
const path = require('path');

const PAYMENT_REFERENCE = process.argv[2] || 'LEVY_1771853902234_146553';
const API_BASE_URL = 'http://localhost:3001/api/v1';
const LOGO_PATH = path.join(__dirname, '..', 'public', 'napps-logo.png');

async function fetchPaymentData() {
  console.log('📡 Fetching payment data...\n');
  
  const response = await fetch(`${API_BASE_URL}/levy-payments/${PAYMENT_REFERENCE}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch payment: ${response.status}`);
  }
  
  return await response.json();
}

function getLogoBase64() {
  try {
    if (fs.existsSync(LOGO_PATH)) {
      const logoBuffer = fs.readFileSync(LOGO_PATH);
      const logoBase64 = logoBuffer.toString('base64');
      return `data:image/png;base64,${logoBase64}`;
    }
  } catch (error) {
    console.log('⚠️  Logo file not found, using fallback');
  }
  return null;
}

function generateHTMLReceipt(payment) {
  const logoDataUrl = getLogoBase64();
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NAPPS Receipt - ${payment.receiptNumber}</title>
    <style>
        @media print {
            body {
                background: white;
                padding: 0;
            }
            .receipt {
                border: none;
                box-shadow: none;
                page-break-inside: avoid;
            }
            .no-print {
                display: none;
            }
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f5f5f5;
            padding: 20px;
        }
        
        .receipt {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border: 4px solid #28a745;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        
        .header {
            background: linear-gradient(135deg, #1e7e34 0%, #28a745 100%);
            color: white;
            padding: 40px;
            text-align: center;
            position: relative;
        }
        
        .logo-container {
            margin: 0 auto 20px;
            width: 120px;
            height: 120px;
        }
        
        .logo-img {
            width: 100%;
            height: 100%;
            display: block;
            border-radius: 50%;
            background: white;
            padding: 15px;
            object-fit: contain;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        
        .logo-fallback {
            width: 120px;
            height: 120px;
            background: white;
            border-radius: 50%;
            margin: 0 auto 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: #1e7e34;
            font-size: 16px;
            text-align: center;
            line-height: 1.2;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        
        .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
            text-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .header h2 {
            font-size: 18px;
            font-weight: normal;
            opacity: 0.95;
            margin-bottom: 5px;
        }
        
        .header h3 {
            font-size: 20px;
            font-weight: 600;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 2px solid rgba(255,255,255,0.3);
        }
        
        .receipt-info {
            background: #ecf0f1;
            padding: 25px 40px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }
        
        .receipt-info-item {
            display: flex;
            flex-direction: column;
        }
        
        .receipt-info-label {
            font-size: 12px;
            color: #7f8c8d;
            margin-bottom: 5px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .receipt-info-value {
            font-size: 14px;
            font-weight: 600;
            color: #2c3e50;
        }
        
        .status {
            color: #27ae60;
            font-weight: bold;
            font-size: 16px;
        }
        
        .content {
            padding: 40px;
        }
        
        .section {
            margin-bottom: 35px;
        }
        
        .section-title {
            font-size: 18px;
            color: #28a745;
            font-weight: bold;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #28a745;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }
        
        .info-item {
            display: flex;
            flex-direction: column;
        }
        
        .info-label {
            font-size: 12px;
            color: #7f8c8d;
            margin-bottom: 5px;
            text-transform: uppercase;
        }
        
        .info-value {
            font-size: 14px;
            color: #2c3e50;
            font-weight: 500;
        }
        
        .payment-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        
        .payment-table thead {
            background: #ecf0f1;
        }
        
        .payment-table th,
        .payment-table td {
            padding: 15px 12px;
            text-align: left;
        }
        
        .payment-table th {
            font-weight: 600;
            color: #2c3e50;
            text-transform: uppercase;
            font-size: 12px;
            letter-spacing: 0.5px;
        }
        
        .payment-table tbody tr {
            border-bottom: 1px solid #ecf0f1;
        }
        
        .payment-table .amount {
            text-align: right;
            font-weight: 600;
            font-size: 16px;
        }
        
        .total-row {
            background: #28a745;
            color: white;
            font-weight: bold;
            font-size: 16px;
        }
        
        .total-row td {
            padding: 18px 12px;
        }
        
        .footer {
            background: #ecf0f1;
            padding: 35px 40px;
            text-align: center;
        }
        
        .footer h3 {
            color: #28a745;
            margin-bottom: 15px;
            font-size: 20px;
        }
        
        .footer p {
            color: #7f8c8d;
            font-size: 13px;
            line-height: 1.8;
            margin-bottom: 10px;
        }
        
        .footer .contact {
            font-weight: 600;
            color: #2c3e50;
        }
        
        .footer .timestamp {
            font-size: 11px;
            color: #95a5a6;
            margin-top: 20px;
            padding-top: 15px;
            border-top: 1px solid #bdc3c7;
        }
        
        .print-button {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: #28a745;
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 50px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(40, 167, 69, 0.4);
            transition: all 0.3s ease;
        }
        
        .print-button:hover {
            background: #218838;
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(40, 167, 69, 0.5);
        }
    </style>
</head>
<body>
    <div class="receipt">
        <div class="header">
            ${logoDataUrl ? `
            <div class="logo-container">
                <img src="${logoDataUrl}" alt="NAPPS Logo" class="logo-img">
            </div>
            ` : `
            <div class="logo-fallback">
                NAPPS<br>NIGERIA
            </div>
            `}
            <h1>NASARAWA STATE BRANCH</h1>
            <h2>National Association of Proprietors of Private Schools</h2>
            <h3>PAYMENT RECEIPT</h3>
        </div>
        
        <div class="receipt-info">
            <div class="receipt-info-item">
                <span class="receipt-info-label">Receipt Number</span>
                <span class="receipt-info-value">${payment.receiptNumber}</span>
            </div>
            <div class="receipt-info-item">
                <span class="receipt-info-label">Reference</span>
                <span class="receipt-info-value" style="font-size: 11px; word-break: break-all;">${payment.reference}</span>
            </div>
            <div class="receipt-info-item">
                <span class="receipt-info-label">Date</span>
                <span class="receipt-info-value">${new Date(payment.paidAt).toLocaleDateString('en-NG', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}</span>
            </div>
            <div class="receipt-info-item">
                <span class="receipt-info-label">Status</span>
                <span class="receipt-info-value status">${payment.status.toUpperCase()} ✓</span>
            </div>
        </div>
        
        <div class="content">
            <div class="section">
                <h3 class="section-title">Payer Information</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Name</span>
                        <span class="info-value">${payment.memberName}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Email</span>
                        <span class="info-value">${payment.email}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Phone</span>
                        <span class="info-value">${payment.phone}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Chapter</span>
                        <span class="info-value">${payment.chapter}</span>
                    </div>
                </div>
            </div>
            
            <div class="section">
                <h3 class="section-title">School Information</h3>
                <div class="info-grid">
                    <div class="info-item" style="grid-column: 1 / -1;">
                        <span class="info-label">School Name</span>
                        <span class="info-value">${payment.schoolName}</span>
                    </div>
                    <div class="info-item" style="grid-column: 1 / -1;">
                        <span class="info-label">Wards</span>
                        <span class="info-value">${payment.wards.join(', ')}</span>
                    </div>
                </div>
            </div>
            
            <div class="section">
                <h3 class="section-title">Payment Details</h3>
                <table class="payment-table">
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th class="amount">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>
                                <strong>NAPPS NASARAWA STATE SECRETARIAT</strong><br>
                                <span style="color: #7f8c8d; font-size: 13px;">Building Levy Payment</span>
                            </td>
                            <td class="amount">₦${(payment.amount / 100).toLocaleString()}</td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr class="total-row">
                            <td>TOTAL AMOUNT PAID</td>
                            <td class="amount">₦${(payment.amount / 100).toLocaleString()}</td>
                        </tr>
                    </tfoot>
                </table>
                <p style="margin-top: 15px; font-size: 13px; color: #7f8c8d;">
                    <strong>Payment Method:</strong> ${payment.paymentMethod ? payment.paymentMethod.toUpperCase() : 'CARD'}
                    ${payment.flutterwaveTransactionId ? `<br><strong>Transaction ID:</strong> ${payment.flutterwaveTransactionId}` : ''}
                </p>
            </div>
        </div>
        
        <div class="footer">
            <h3>Thank you for your payment!</h3>
            <p>This is an official payment receipt generated by the National Association of Proprietors of Private Schools (NAPPS), Nasarawa State Branch.</p>
            <p class="contact">For inquiries, please contact: <strong>info@nappsnasarawa.com</strong> | Tel: <strong>+234 XXX XXX XXXX</strong></p>
            <p class="timestamp">Generated on: ${new Date().toLocaleString('en-NG', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
        </div>
    </div>
    
    <button class="print-button no-print" onclick="window.print()">🖨️ Print Receipt</button>
    
    <script>
        // Auto-print option (commented out by default)
        // window.onload = function() { window.print(); }
    </script>
</body>
</html>
`;

  return html;
}

async function main() {
  try {
    console.log('📄 NAPPS Receipt Generator with Logo');
    console.log('='.repeat(70));
    console.log(`Reference: ${PAYMENT_REFERENCE}\n`);

    // Check if logo exists
    if (fs.existsSync(LOGO_PATH)) {
      console.log(`✅ Logo found: ${LOGO_PATH}\n`);
    } else {
      console.log(`⚠️  Logo not found at: ${LOGO_PATH}`);
      console.log('   Using fallback text logo\n');
    }

    // Fetch payment data
    const payment = await fetchPaymentData();

    console.log('✅ Payment data fetched successfully\n');
    console.log('📋 Payment Details:');
    console.log(`   - Receipt Number: ${payment.receiptNumber}`);
    console.log(`   - Status: ${payment.status}`);
    console.log(`   - Amount: ₦${(payment.amount / 100).toLocaleString()}`);
    console.log(`   - Member: ${payment.memberName}\n`);

    // Generate HTML receipt with logo
    const htmlReceipt = generateHTMLReceipt(payment);
    const htmlFilename = `NAPPS_Receipt_${payment.receiptNumber}_WithLogo.html`;
    fs.writeFileSync(htmlFilename, htmlReceipt);
    console.log(`✅ HTML receipt with logo saved: ${htmlFilename}`);

    console.log('\n' + '='.repeat(70));
    console.log('🎉 SUCCESS!');
    console.log('='.repeat(70));
    console.log('\n📁 File Generated:');
    console.log(`   ${htmlFilename}`);
    console.log('\n💡 Next Steps:');
    console.log('   1. Open the HTML file in your browser');
    console.log('   2. Click the "Print Receipt" button or use Ctrl+P');
    console.log('   3. Select "Save as PDF" as the printer');
    console.log('   4. Save the PDF receipt');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
