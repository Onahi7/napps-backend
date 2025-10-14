// Quick test script to verify fees exist in database
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://mmmnigeriaschool12_db_user:Iamhardy_7*@cluster0.abdi7yt.mongodb.net/napps_nasarawa?retryWrites=true&w=majority&appName=Cluster0&ssl=true&authSource=admin';

async function testFees() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Define schema - USE 'fees' COLLECTION
    const feeSchema = new mongoose.Schema({
      name: String,
      code: String,
      amount: Number,
      isActive: Boolean,
    }, { collection: 'fees' });

    const FeeModel = mongoose.model('FeeConfiguration', feeSchema);

    console.log('\n📊 Fetching all fees from fees collection...');
    const allFees = await FeeModel.find({}).lean();
    console.log(`Total fees found: ${allFees.length}`);
    console.log('All fees:', JSON.stringify(allFees, null, 2));

    console.log('\n🎯 Fetching active fees only...');
    const activeFees = await FeeModel.find({ isActive: true }).lean();
    console.log(`Active fees found: ${activeFees.length}`);
    console.log('Active fees:', JSON.stringify(activeFees, null, 2));

    if (activeFees.length > 0) {
      const total = activeFees.reduce((sum, fee) => sum + fee.amount, 0);
      console.log(`\n💰 Total of active fees: ₦${total.toLocaleString()}`);
      console.log(`💰 Doubled for new registration: ₦${(total * 2).toLocaleString()}`);
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testFees();
