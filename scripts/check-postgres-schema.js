/**
 * Check PostgreSQL schema for schools table
 */

const { Client } = require('pg');

async function checkSchema() {
  const client = new Client({
    connectionString: process.env.POSTGRES_DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL\n');

    // Check schools table columns
    console.log('Schools table columns:');
    const schoolsColumns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'schools'
      ORDER BY ordinal_position
    `);
    
    schoolsColumns.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

    console.log('\nSample school record:');
    const sampleSchool = await client.query(`SELECT * FROM schools LIMIT 1`);
    if (sampleSchool.rows.length > 0) {
      console.log(JSON.stringify(sampleSchool.rows[0], null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkSchema();
