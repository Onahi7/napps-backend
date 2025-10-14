// List all collections in the database
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://mmmnigeriaschool12_db_user:Iamhardy_7*@cluster0.abdi7yt.mongodb.net/napps_nasarawa?retryWrites=true&w=majority&appName=Cluster0&ssl=true&authSource=admin';

async function listCollections() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    console.log(`\n📦 Found ${collections.length} collections:`);
    console.log('='.repeat(50));
    
    for (const collection of collections) {
      const count = await db.collection(collection.name).countDocuments();
      console.log(`📁 ${collection.name} (${count} documents)`);
      
      // If it looks like a fee collection, show sample
      if (collection.name.toLowerCase().includes('fee')) {
        const sample = await db.collection(collection.name).findOne();
        console.log(`   Sample:`, JSON.stringify(sample, null, 2));
      }
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

listCollections();
