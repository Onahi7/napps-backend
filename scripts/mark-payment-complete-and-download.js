/**
 * Mark a payment as completed and generate receipt
 * This simulates a successful Flutterwave payment verification
 */

const mongoose = require('mongoose');
const { jsPDF } = require('jspdf');
require('jspdf-autotable');
const fs = require('fs');
const path = require('path');

// Payment reference from the test
const PAYMENT_REFERENCE = process.argv[2] || 'LEVY_1771853902234_146553';

const MONGODB_URI = process.env.MONGODB_URI || 
  'mongodb+srv://mmmnigeriaschool12_db_user:Iamhardy_7*@cluster0.abdi7yt.mongodb.net/napps_nasarawa?retryWrites=true&w=majority&appName=Cluster0&ssl=true&authSource=admin';

async function markPaymentComplete() {
  console.log('🔄 Marking Payment as Complete');
  console.log('='.repeat(70));
  console.log(`Reference: ${PAYMENT_REFERENCE}\n`);

  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get the payment
    const LevyPayment = mongoose.model('LevyPayment', new mongoose.Schema({}, { strict: false }));
    
    const payment = await LevyPayment.findOne({ reference: PAYMENT_REFERENCE });

    if (!payment) {
      throw new Error('Payment not found');
    }

    console.log('📋 Current Payment Status:');
    console.log(`   - Status: ${payment.status}`);
    console.log(`   - Amount: ₦${(payment.amount / 100).toLocaleString()}`);
    console.log(`   - Member: ${payment.memberName}`);
    console.log(`   - Email: ${payment.email}\n`);

    // Update payment to success (use yesterday's date: 23/02/2026)
    const yesterdayDate = new Date('2026-02-23T16:10:07');
    const updateData = {
      status: 'success',
      paidAt: yesterdayDate,
      flutterwaveTransactionId: `FLW_TEST_${Date.now()}`,
      flutterwavePaymentId: `flwref_${Date.now()}`,
      gatewayResponse: 'Successful',
      paymentMethod: 'card',
    };

    await LevyPayment.updateOne({ reference: PAYMENT_REFERENCE }, updateData);

    console.log('✅ Payment marked as SUCCESSFUL\n');

    // Get updated payment
    const updatedPayment = await LevyPayment.findOne({ reference: PAYMENT_REFERENCE });

    console.log('📋 Updated Payment Details:');
    console.log(`   - Status: ${updatedPayment.status}`);
    console.log(`   - Paid At: ${updatedPayment.paidAt.toLocaleString()}`);
    console.log(`   - Transaction ID: ${updatedPayment.flutterwaveTransactionId}`);
    console.log(`   - Payment Method: ${updatedPayment.paymentMethod}\n`);

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB\n');

    return updatedPayment.toObject();

  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect();
    throw error;
  }
}

function generatePDFReceipt(paymentData) {
  console.log('📄 Generating PDF Receipt');
  console.log('='.repeat(70) + '\n');

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;

  // NAPPS Colors - Light Green theme
  const primaryGreen = [34, 139, 34]; // Forest Green
  const lightGreen = [144, 238, 144]; // Light Green
  const darkGreen = [0, 100, 0]; // Dark Green
  const secondaryColor = [52, 73, 94]; // Dark gray
  const lightGray = [240, 255, 240]; // Honeydew (light green tint)
  const successGreen = [34, 139, 34];

  let currentY = margin;

  // Header background - Light Green
  doc.setFillColor(...lightGreen);
  doc.rect(0, 0, pageWidth, 50, 'F');

  // Add NAPPS Logo (using the logo from public folder)
  const logoPath = path.join(__dirname, '../public/napps-logo.png');
  
  try {
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      const logoBase64 = logoBuffer.toString('base64');
      doc.addImage(`data:image/png;base64,${logoBase64}`, 'PNG', pageWidth - 45, 10, 30, 30);
    } else {
      // Fallback logo circle
      doc.setFillColor(255, 255, 255);
      doc.circle(pageWidth - 35, 25, 15, 'F');
      doc.setFontSize(10);
      doc.setTextColor(...primaryGreen);
      doc.text('NAPPS', pageWidth - 35, 27, { align: 'center' });
    }
  } catch (error) {
    // Fallback logo circle
    doc.setFillColor(255, 255, 255);
    doc.circle(pageWidth - 35, 25, 15, 'F');
    doc.setFontSize(10);
    doc.setTextColor(...primaryGreen);
    doc.text('NAPPS', pageWidth - 35, 27, { align: 'center' });
  }

  // Title
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkGreen);
  doc.text('PAYMENT RECEIPT', margin, 30);

  // Organization name
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...primaryGreen);
  doc.text('National Association of Proprietors of Private Schools', margin, 40);
  doc.text('Nasarawa State Chapter', margin, 46);

  currentY = 60;

  // Receipt info box
  doc.setFillColor(...lightGray);
  doc.roundedRect(margin, currentY, contentWidth, 25, 3, 3, 'F');

  doc.setFontSize(10);
  doc.setTextColor(...secondaryColor);
  doc.setFont('helvetica', 'bold');
  doc.text('Receipt No:', margin + 5, currentY + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(paymentData.receiptNumber, margin + 35, currentY + 8);

  doc.setFont('helvetica', 'bold');
  doc.text('Date:', margin + 5, currentY + 16);
  doc.setFont('helvetica', 'normal');
  const paymentDate = new Date(paymentData.paidAt).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  doc.text(paymentDate, margin + 35, currentY + 16);

  doc.setFont('helvetica', 'bold');
  doc.text('Reference:', pageWidth / 2 + 5, currentY + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(paymentData.reference, pageWidth / 2 + 30, currentY + 8);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Status:', pageWidth / 2 + 5, currentY + 16);
  doc.setTextColor(...successGreen);
  doc.text('PAID', pageWidth / 2 + 30, currentY + 16);

  currentY += 35;

  // Payer Information
  doc.setTextColor(...primaryGreen);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYER INFORMATION', margin, currentY);

  currentY += 8;
  doc.setDrawColor(...primaryGreen);
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  currentY += 8;
  doc.setFontSize(10);
  doc.setTextColor(...secondaryColor);

  const payerDetails = [
    ['Name:', paymentData.memberName],
    ['Email:', paymentData.email],
    ['Phone:', paymentData.phone],
    ['Chapter:', paymentData.chapter],
  ];

  payerDetails.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(value, margin + 35, currentY);
    currentY += 7;
  });

  currentY += 5;

  // School Information
  doc.setTextColor(...primaryGreen);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('SCHOOL INFORMATION', margin, currentY);

  currentY += 8;
  doc.setDrawColor(...primaryGreen);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  currentY += 8;
  doc.setFontSize(10);
  doc.setTextColor(...secondaryColor);
  doc.setFont('helvetica', 'bold');
  doc.text('School Name:', margin, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(paymentData.schoolName, margin + 35, currentY);

  currentY += 10;
  doc.setFont('helvetica', 'bold');
  doc.text('Wards:', margin, currentY);
  doc.setFont('helvetica', 'normal');
  const wardsText = paymentData.wards.join(', ');
  doc.text(wardsText, margin + 35, currentY);

  currentY += 15;

  // Payment Details
  doc.setTextColor(...primaryGreen);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYMENT DETAILS', margin, currentY);

  currentY += 8;
  doc.setDrawColor(...primaryGreen);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  currentY += 8;

  // Payment table header
  doc.setFillColor(...lightGray);
  doc.rect(margin, currentY, contentWidth, 10, 'F');

  doc.setFontSize(10);
  doc.setTextColor(...secondaryColor);
  doc.setFont('helvetica', 'bold');
  doc.text('Description', margin + 5, currentY + 7);
  doc.text('Amount', pageWidth - margin - 40, currentY + 7);

  currentY += 12;

  // Payment row
  doc.setFont('helvetica', 'normal');
  doc.text('NAPPS NASARAWA STATE SECRETARIAT', margin + 5, currentY + 2);
  doc.text('BUILDING LEVY', margin + 5, currentY + 7);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`NGN ${(paymentData.amount / 100).toLocaleString()}`, pageWidth - margin - 40, currentY + 5);

  currentY += 12;
  doc.setDrawColor(...secondaryColor);
  doc.setLineWidth(0.3);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  currentY += 8;

  // Total
  doc.setFillColor(...primaryGreen);
  doc.rect(margin, currentY, contentWidth, 12, 'F');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL AMOUNT PAID', margin + 5, currentY + 8);
  doc.setFontSize(14);
  doc.text(`NGN ${(paymentData.amount / 100).toLocaleString()}`, pageWidth - margin - 40, currentY + 8);

  currentY += 20;

  // Payment method
  doc.setFontSize(9);
  doc.setTextColor(...secondaryColor);
  doc.setFont('helvetica', 'normal');
  doc.text(`Payment Method: ${paymentData.paymentMethod.toUpperCase()}`, margin, currentY);

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 40;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryGreen);
  doc.text('Thank you for your payment!', pageWidth / 2, footerY, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  doc.text(
    'This is an official payment receipt generated by NAPPS Nasarawa State.',
    pageWidth / 2,
    footerY + 6,
    { align: 'center' }
  );
  doc.text(
    'For inquiries, please contact: info@nappsnasarawa.com | +234 XXX XXX XXXX',
    pageWidth / 2,
    footerY + 11,
    { align: 'center' }
  );

  doc.setDrawColor(...primaryGreen);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY + 16, pageWidth - margin, footerY + 16);

  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Generated on: ${new Date().toLocaleString('en-NG')}`,
    pageWidth / 2,
    footerY + 20,
    { align: 'center' }
  );

  // Save the PDF
  const fileName = `NAPPS_Levy_Receipt_${paymentData.receiptNumber}_${Date.now()}.pdf`;
  doc.save(fileName);

  console.log(`✅ PDF Receipt Generated: ${fileName}\n`);
  console.log('📁 Receipt saved to current directory\n');
}

async function main() {
  try {
    console.log('🚀 Starting Payment Completion Process\n');
    
    // Step 1: Mark payment as complete
    const paymentData = await markPaymentComplete();

    // Step 2: Generate PDF receipt
    generatePDFReceipt(paymentData);

    console.log('='.repeat(70));
    console.log('🎉 SUCCESS!');
    console.log('='.repeat(70));
    console.log('\n✅ Payment marked as completed');
    console.log('✅ PDF receipt generated and saved');
    console.log('\n📋 Payment Summary:');
    console.log(`   - Reference: ${paymentData.reference}`);
    console.log(`   - Receipt Number: ${paymentData.receiptNumber}`);
    console.log(`   - Amount: ₦${(paymentData.amount / 100).toLocaleString()}`);
    console.log(`   - Status: ${paymentData.status}`);
    console.log(`   - Paid At: ${new Date(paymentData.paidAt).toLocaleString()}`);
    console.log(`   - Member: ${paymentData.memberName}`);
    console.log(`   - Chapter: ${paymentData.chapter}`);
    console.log(`   - School: ${paymentData.schoolName}`);

  } catch (error) {
    console.error('\n❌ Process Failed:', error.message);
    process.exit(1);
  }
}

main();
