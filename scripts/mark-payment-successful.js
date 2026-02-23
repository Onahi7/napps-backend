/**
 * Mark a payment as successful manually
 * Use this when you know a payment was successful but verification fails
 */

const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

// Payment reference to mark as successful
const REFERENCE = 'LEVY_1771859666183_904936';

async function markPaymentSuccessful() {
  console.log(`🔄 Marking payment ${REFERENCE} as successful...\n`);

  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in .env file');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db();
    const paymentsCollection = db.collection('levypayments');

    // Find the payment
    const payment = await paymentsCollection.findOne({ reference: REFERENCE });

    if (!payment) {
      console.error(`❌ Payment with reference ${REFERENCE} not found`);
      process.exit(1);
    }

    console.log('\n📋 Current Payment Status:');
    console.log(`   Reference: ${payment.reference}`);
    console.log(`   Status: ${payment.status}`);
    console.log(`   Member: ${payment.memberName}`);
    console.log(`   Email: ${payment.email}`);
    console.log(`   Amount: ₦${(payment.amount / 100).toLocaleString()}`);

    if (payment.status === 'success') {
      console.log('\n✅ Payment is already marked as successful!');
      return;
    }

    // Update to successful
    const result = await paymentsCollection.updateOne(
      { reference: REFERENCE },
      {
        $set: {
          status: 'success',
          paidAt: new Date(),
          gatewayResponse: 'Manually marked as successful',
          paymentMethod: 'card',
          updatedAt: new Date(),
        },
      }
    );

    if (result.modifiedCount > 0) {
      console.log('\n✅ Payment successfully marked as SUCCESSFUL!');
      console.log(`   Receipt Number: ${payment.receiptNumber}`);
      console.log(`   Paid At: ${new Date().toLocaleString('en-NG')}`);
      
      // Update proprietor if linked
      if (payment.proprietorId) {
        const proprietorsCollection = db.collection('proprietors');
        await proprietorsCollection.updateOne(
          { _id: new ObjectId(payment.proprietorId) },
          {
            $set: {
              paymentStatus: 'paid',
              'metadata.levyPaymentReference': payment.reference,
              'metadata.levyPaymentDate': new Date(),
            },
          }
        );
        console.log('   ✅ Proprietor payment status updated');
      }
    } else {
      console.log('\n⚠️  No changes made');
    }

  } catch (error) {
    console.error('\n❌ ERROR!');
    console.error(`   ${error.message}`);
    process.exit(1);
  } finally {
    await client.close();
  }
}

markPaymentSuccessful();
