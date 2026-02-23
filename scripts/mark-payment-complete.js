/**
 * Mark a payment as completed
 * This simulates a successful Flutterwave payment verification
 */

const mongoose = require('mongoose');

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
    console.log(`   - Email: ${payment.email}`);
    console.log(`   - Phone: ${payment.phone}`);
    console.log(`   - Chapter: ${payment.chapter}`);
    console.log(`   - School: ${payment.schoolName}`);
    console.log(`   - Wards: ${payment.wards.join(', ')}\n`);

    if (payment.status === 'success') {
      console.log('ℹ️  Payment is already marked as successful\n');
    } else {
      // Update payment to success
      const updateData = {
        status: 'success',
        paidAt: new Date(),
        flutterwaveTransactionId: `FLW_TEST_${Date.now()}`,
        flutterwavePaymentId: `flwref_${Date.now()}`,
        gatewayResponse: 'Successful',
        paymentMethod: 'card',
      };

      await LevyPayment.updateOne({ reference: PAYMENT_REFERENCE }, updateData);

      console.log('✅ Payment marked as SUCCESSFUL\n');
    }

    // Get updated payment
    const updatedPayment = await LevyPayment.findOne({ reference: PAYMENT_REFERENCE });

    console.log('📋 Updated Payment Details:');
    console.log(`   - Status: ${updatedPayment.status}`);
    console.log(`   - Receipt Number: ${updatedPayment.receiptNumber}`);
    console.log(`   - Paid At: ${new Date(updatedPayment.paidAt).toLocaleString()}`);
    console.log(`   - Transaction ID: ${updatedPayment.flutterwaveTransactionId}`);
    console.log(`   - Payment Method: ${updatedPayment.paymentMethod}\n`);

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB\n');

    console.log('='.repeat(70));
    console.log('🎉 SUCCESS!');
    console.log('='.repeat(70));
    console.log('\n📝 Next Steps:');
    console.log('   1. Open the frontend application');
    console.log('   2. Navigate to: /levy-payment/verify?reference=' + PAYMENT_REFERENCE);
    console.log('   3. Click "Download Receipt" to generate PDF\n');
    console.log('   Or use the API:');
    console.log(`   GET http://localhost:3001/api/v1/levy-payments/verify/${PAYMENT_REFERENCE}\n`);

    console.log('📊 Payment Summary:');
    console.log(`   - Reference: ${updatedPayment.reference}`);
    console.log(`   - Receipt Number: ${updatedPayment.receiptNumber}`);
    console.log(`   - Amount: ₦${(updatedPayment.amount / 100).toLocaleString()}`);
    console.log(`   - Status: ${updatedPayment.status}`);
    console.log(`   - Member: ${updatedPayment.memberName}`);
    console.log(`   - Email: ${updatedPayment.email}`);
    console.log(`   - Chapter: ${updatedPayment.chapter}`);
    console.log(`   - School: ${updatedPayment.schoolName}`);
    console.log(`   - Wards: ${updatedPayment.wards.join(', ')}`);

    return updatedPayment.toObject();

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await mongoose.disconnect();
    throw error;
  }
}

markPaymentComplete()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
