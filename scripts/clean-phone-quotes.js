const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');

const uri = 'mongodb+srv://mmmnigeriaschool12_db_user:***REMOVED***@cluster0.abdi7yt.mongodb.net/napps_nasarawa?retryWrites=true&w=majority&appName=Cluster0&ssl=true&authSource=admin';

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const proprietors = await db.collection('proprietors').find({ phone: { $regex: /^['"]/ } }).toArray();
  console.log(`Found ${proprietors.length} proprietors with leading quote in phone.`);

  if (proprietors.length > 0) {
    const bulkOps = proprietors.map(p => ({
      updateOne: {
        filter: { _id: p._id },
        update: { $set: { phone: p.phone.replace(/^['"\s]+|['"\s]+$/g, '').trim() } }
      }
    }));
    const res = await db.collection('proprietors').bulkWrite(bulkOps);
    console.log(`Updated ${res.modifiedCount} proprietors phone numbers.`);
  }

  const schools = await db.collection('schools').find({ phone: { $regex: /^['"]/ } }).toArray();
  console.log(`Found ${schools.length} schools with leading quote in phone.`);
  if (schools.length > 0) {
    const bulkOps = schools.map(s => ({
      updateOne: {
        filter: { _id: s._id },
        update: { $set: { phone: s.phone.replace(/^['"\s]+|['"\s]+$/g, '').trim() } }
      }
    }));
    const res = await db.collection('schools').bulkWrite(bulkOps);
    console.log(`Updated ${res.modifiedCount} schools phone numbers.`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
