/**
 * HTTP-based test script for school-chapter dynamic loading
 * Tests the API endpoints without direct database access
 * 
 * Usage: 
 *   npm run test:school-chapters-api
 * 
 * Or with custom URL:
 *   API_URL=http://localhost:3000 npm run test:school-chapters-api
 */

import { NAPPS_CHAPTERS } from '../src/constants/napps-chapters';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';

interface School {
  id: string;
  name: string;
  lga?: string;
  chapter?: string;
}

interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
  details?: any;
}

async function fetchSchools(chapter?: string): Promise<School[]> {
  const url = chapter 
    ? `${API_BASE_URL}/levy-payments/schools?chapter=${encodeURIComponent(chapter)}`
    : `${API_BASE_URL}/levy-payments/schools`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return await response.json();
}

async function testSchoolChapterAPI() {
  console.log('='.repeat(60));
  console.log('School-Chapter API Test Suite');
  console.log('='.repeat(60));
  console.log(`Testing API at: ${API_BASE_URL}`);