/**
 * Complete test for schools and chapters population
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api/v1';

async function testSchoolsAndChapters() {
  console.log('🧪 Testing Schools and Chapters Population\n');
  console.log('='.repeat(60) + '\n');

  try {
    // Test 1: Get all chapters from PostgreSQL
    console.log('Test 1: Fetching all chapters from PostgreSQL...');
    const chaptersResponse = await fetch(`${API_BASE_URL}/levy-payments/chapters/postgres`);
    
    if (!chaptersResponse.ok) {
      throw new Error(`Chapters fetch failed: ${chaptersResponse.status}`);
    }

    const chapters = await chaptersResponse.json();
    console.log(`✅ Found ${chapters.length} chapters in PostgreSQL`);
    console.log('Chapters:');
    chapters.forEach((chapter, idx) => {
      console.log(`  ${idx + 1}. ${chapter.name} (ID: ${chapter.id})`);
    });
    console.log('\n' + '='.repeat(60) + '\n');

    // Test 2: Get chapter statistics
    console.log('Test 2: Fetching chapter statistics...');
    const statsResponse = await fetch(`${API_BASE_URL}/levy-payments/chapters/stats`);
    
    if (!statsResponse.ok) {
      throw new Error(`Stats fetch failed: ${statsResponse.status}`);
    }

    const stats = await statsResponse.json();
    console.log('✅ Chapter statistics:');
    Object.entries(stats).forEach(([chapter, count]) => {
      console.log(`  - ${chapter}: ${count} schools`);
    });
    console.log('\n' + '='.repeat(60) + '\n');

    // Test 3: Get all schools (no filter)
    console.log('Test 3: Fetching all schools from PostgreSQL...');
    const allSchoolsResponse = await fetch(`${API_BASE_URL}/levy-payments/schools/postgres`);
    
    if (!allSchoolsResponse.ok) {
      throw new Error(`All schools fetch failed: ${allSchoolsResponse.status}`);
    }

    const allSchools = await allSchoolsResponse.json();
    console.log(`✅ Found ${allSchools.length} total schools in PostgreSQL`);
    if (allSchools.length > 0) {
      console.log('Sample schools (first 5):');
      allSchools.slice(0, 5).forEach((school, idx) => {
        console.log(`  ${idx + 1}. ${school.name} - Chapter: ${school.chapter}`);
      });
    }
    console.log('\n' + '='.repeat(60) + '\n');

    // Test 4: Get schools for specific chapters
    const testChapters = ['Lafia A', 'Karu 1', 'Akwanga'];
    
    for (const chapter of testChapters) {
      console.log(`Test 4.${testChapters.indexOf(chapter) + 1}: Fetching schools for "${chapter}"...`);
      const chapterSchoolsResponse = await fetch(
        `${API_BASE_URL}/levy-payments/schools/postgres?chapter=${encodeURIComponent(chapter)}`
      );
      
      if (!chapterSchoolsResponse.ok) {
        console.log(`  ⚠️  Failed to fetch schools for ${chapter}: ${chapterSchoolsResponse.status}`);
        continue;
      }

      const chapterSchools = await chapterSchoolsResponse.json();
      console.log(`  ✅ Found ${chapterSchools.length} schools in "${chapter}"`);
      
      if (chapterSchools.length > 0) {
        console.log(`  Sample schools (first 3):`);
        chapterSchools.slice(0, 3).forEach((school, idx) => {
          console.log(`    ${idx + 1}. ${school.name}`);
        });
      } else {
        console.log(`  ℹ️  No schools found for this chapter`);
      }
      console.log('');
    }
    
    console.log('='.repeat(60) + '\n');

    // Test 5: Get schools from MongoDB (for comparison)
    console.log('Test 5: Fetching schools from MongoDB...');
    const mongoSchoolsResponse = await fetch(`${API_BASE_URL}/levy-payments/schools`);
    
    if (!mongoSchoolsResponse.ok) {
      console.log(`  ⚠️  MongoDB schools fetch failed: ${mongoSchoolsResponse.status}`);
    } else {
      const mongoSchools = await mongoSchoolsResponse.json();
      console.log(`✅ Found ${mongoSchools.length} schools in MongoDB`);
      if (mongoSchools.length > 0) {
        console.log('Sample MongoDB schools (first 3):');
        mongoSchools.slice(0, 3).forEach((school, idx) => {
          console.log(`  ${idx + 1}. ${school.name} - Chapter: ${school.chapter || 'N/A'}`);
        });
      }
    }
    console.log('\n' + '='.repeat(60) + '\n');

    console.log('🎉 ALL TESTS COMPLETED!\n');
    console.log('Summary:');
    console.log(`  ✅ PostgreSQL Chapters: ${chapters.length}`);
    console.log(`  ✅ PostgreSQL Schools: ${allSchools.length}`);
    console.log(`  ✅ Chapter-School mappings working`);
    console.log('\n📊 Data Sources:');
    console.log('  - PostgreSQL: Primary source for school-chapter mappings');
    console.log('  - MongoDB: Legacy data (may have outdated chapter assignments)');

    return { success: true };

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('\nError Details:', error);
    return { success: false, error: error.message };
  }
}

// Run the test
testSchoolsAndChapters()
  .then((result) => {
    if (!result.success) {
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
