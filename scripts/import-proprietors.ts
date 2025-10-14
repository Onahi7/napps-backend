import { NestFactory } from '@nestjs/core';
import { Model } from 'mongoose';
import { AppModule } from '../src/app.module';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import { Proprietor } from '../src/schemas/proprietor.schema';
import { School } from '../src/schemas/school.schema';

interface CsvRecord {
  Name: string;
  Sex: string;
  Email: string;
  'Phone/Mobile': string;
  'Name Of School': string;
  'Name Of School 2': string;
  Address: string;
  LGA: string;
  'AEQEO ZONE': string;
  'GPS LONGITUDE': string;
  'GPS LATITUDE': string;
  'Type of School': string;
  'Category of School': string;
  'Ownsership': string;
  'Year of Establishment': string;
  'Year of Approval': string;
  'Registeration Status': string;
  'Approval Status': string;
  'Are you registered with NAPPs ?': string;
  'tabular_grid': string;
  'How many times your School participated in Napps Nasarawa State Unified Certificate Examination': string;
  'Number of Pupils presented in year 2023/2024 NAPPS Nasarawa State certificate examination': string;
  'Award given to you / your School by NAPPS for the past four years': string;
  'Position Held at NAPPS Level Progressively': string;
  [key: string]: any;
}

type NappsRegistrationStatus = 'Not Registered' | 'Registered' | 'Registered with Certificate';
type SchoolTypeOption = 'Faith Based' | 'Conventional' | 'Islamiyah Integrated' | 'Secular' | 'Other';
type OwnershipOption = 'Individual(s)' | 'Sole' | 'Partnership' | 'Corporate' | 'Community' | 'Religious Organization' | 'Other';

interface PersonalInfo {
  firstName: string;
  middleName?: string;
  lastName: string;
  sex: 'Male' | 'Female';
  email: string;
  phone: string;
  nappsRegistered: NappsRegistrationStatus;
  participationHistory: string[];
  timesParticipated: number;
  pupilsPresentedLastExam: number;
  awards?: string;
  positionHeld?: string;
}

interface SchoolInfo {
  schoolName: string;
  schoolName2?: string;
  address: string;
  addressLine2?: string;
  lga?: string;
  aeqeoZone?: string;
  gpsLongitude?: number;
  gpsLatitude?: number;
  typeOfSchool?: SchoolTypeOption;
  categoryOfSchool: string;
  ownership?: OwnershipOption;
  yearOfEstablishment?: number;
  yearOfApproval?: number;
  registrationEvidence?: string;
}

type EnrollmentRecord = Partial<{
  kg1Male: number;
  kg1Female: number;
  kg2Male: number;
  kg2Female: number;
  eccdMale: number;
  eccdFemale: number;
  nursery1Male: number;
  nursery1Female: number;
  nursery2Male: number;
  nursery2Female: number;
  primary1Male: number;
  primary1Female: number;
  primary2Male: number;
  primary2Female: number;
  primary3Male: number;
  primary3Female: number;
  primary4Male: number;
  primary4Female: number;
  primary5Male: number;
  primary5Female: number;
  primary6Male: number;
  primary6Female: number;
  jss1Male: number;
  jss1Female: number;
  jss2Male: number;
  jss2Female: number;
  jss3Male: number;
  jss3Female: number;
  ss1Male: number;
  ss1Female: number;
  ss2Male: number;
  ss2Female: number;
  ss3Male: number;
  ss3Female: number;
}>;

const ENROLLMENT_FIELD_MAP: Array<{ csv: string; field: keyof EnrollmentRecord }> = [
  { csv: 'KG1/ECCD Male', field: 'kg1Male' },
  { csv: 'KG1/ECCD Female', field: 'kg1Female' },
  { csv: 'KG2/ECCD MALE', field: 'kg2Male' },
  { csv: 'KG2/ECCD Female', field: 'kg2Female' },
  { csv: 'NURSERY 1 Male', field: 'nursery1Male' },
  { csv: 'NURSERY1 Female', field: 'nursery1Female' },
  { csv: 'NURSERY 2 Male', field: 'nursery2Male' },
  { csv: 'NURSERY 2 Female', field: 'nursery2Female' },
  { csv: 'PRIMARY 1 Male', field: 'primary1Male' },
  { csv: 'PRIMARY 1 Female', field: 'primary1Female' },
  { csv: 'PRIMARY 2 Male', field: 'primary2Male' },
  { csv: 'PRIMARY 2 Female', field: 'primary2Female' },
  { csv: 'PRIMARY 3 Male', field: 'primary3Male' },
  { csv: 'PRIMARY 3 Female', field: 'primary3Female' },
  { csv: 'PRIMARY 4 Male', field: 'primary4Male' },
  { csv: 'PRIMARY 4 Female', field: 'primary4Female' },
  { csv: 'PRIMARY 5 Male', field: 'primary5Male' },
  { csv: 'PRIMARY 5 Female', field: 'primary5Female' },
  { csv: 'PRIMARY 6 Male', field: 'primary6Male' },
  { csv: 'PRIMARY 6 Female', field: 'primary6Female' },
  { csv: 'JSS1 Male', field: 'jss1Male' },
  { csv: 'JSS1 Female', field: 'jss1Female' },
  { csv: 'JSS2 Male', field: 'jss2Male' },
  { csv: 'JSS2 Female', field: 'jss2Female' },
  { csv: 'JSS3 Male', field: 'jss3Male' },
  { csv: 'JSS3 Female', field: 'jss3Female' },
  { csv: 'SS1 Male', field: 'ss1Male' },
  { csv: 'SS1 Female', field: 'ss1Female' },
  { csv: 'SS2 Male', field: 'ss2Male' },
  { csv: 'SS2 Female', field: 'ss2Female' },
  { csv: 'SS3 Male', field: 'ss3Male' },
  { csv: 'SS3 Female', field: 'ss3Female' },
];

async function bootstrap() {
  console.log('🚀 Starting CSV Import Script...\n');
  const app = await NestFactory.createApplicationContext(AppModule);
  const proprietorModel = app.get<Model<Proprietor>>('ProprietorModel');
  const schoolModel = app.get<Model<School>>('SchoolModel');
  const csvFilePath = path.join(__dirname, '../../Book1.csv');
  
  if (!fs.existsSync(csvFilePath)) {
    console.error(`❌ CSV file not found at: ${csvFilePath}`);
    process.exit(1);
  }
  
  const records: CsvRecord[] = [];
  let successCount = 0;
  let errorCount = 0;
  let updatedCount = 0;
  let schoolsCreated = 0;
  let schoolsUpdated = 0;
  
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (data: any) => records.push(data))
      .on('end', () => resolve())
      .on('error', reject);
  });
  
  console.log(`📄 Found ${records.length} records\n`);
  
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const rowNumber = i + 2;
    
    try {
      const { proprietorData, schoolData } = mapCsvToProprietorAndSchool(record, rowNumber);
      let proprietor = await proprietorModel.findOne({ email: proprietorData.email });
      
      if (proprietor) {
        await proprietorModel.updateOne({ _id: proprietor._id }, { $set: proprietorData });
        updatedCount++;
        console.log(`🔄 Row ${rowNumber}: Updated - ${proprietorData.firstName} ${proprietorData.lastName}`);
      } else {
        proprietorData.registrationNumber = await generateRegistrationNumber(proprietorModel, successCount);
        proprietor = new proprietorModel(proprietorData);
        await proprietor.save();
        successCount++;
        console.log(`✅ Row ${rowNumber}: Created - ${proprietorData.firstName} ${proprietorData.lastName}`);
      }
      
      if (schoolData.schoolName) {
        const existingSchool = await schoolModel.findOne({ proprietorId: proprietor._id, isPrimary: true });
        
        if (existingSchool) {
          await schoolModel.updateOne({ _id: existingSchool._id }, { $set: schoolData });
          schoolsUpdated++;
          console.log(`   🔄 School: ${schoolData.schoolName}`);
        } else {
          schoolData.proprietorId = proprietor._id;
          const newSchool = new schoolModel(schoolData);
          await newSchool.save();
          schoolsCreated++;
          console.log(`   ✅ School: ${schoolData.schoolName}`);
        }
      }
    } catch (error) {
      errorCount++;
      console.error(`❌ Row ${rowNumber}: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log(`Total: ${records.length} | Created: ${successCount} | Updated: ${updatedCount}`);
  console.log(`Schools Created: ${schoolsCreated} | Schools Updated: ${schoolsUpdated} | Errors: ${errorCount}`);
  console.log('='.repeat(70));
  await app.close();
  process.exit(0);
}

function mapCsvToProprietorAndSchool(record: CsvRecord, rowNumber: number) {
  const proprietorData: any = {};
  const nameParts = record.Name?.trim().split(/\s+/) || [];
  
  if (nameParts.length >= 3) {
    proprietorData.firstName = nameParts[0];
    proprietorData.middleName = nameParts.slice(1, -1).join(' ');
    proprietorData.lastName = nameParts[nameParts.length - 1];
  } else if (nameParts.length === 2) {
    proprietorData.firstName = nameParts[0];
    proprietorData.lastName = nameParts[1];
  } else {
    proprietorData.firstName = nameParts[0] || 'Unknown';
    proprietorData.lastName = nameParts[0] || 'Unknown';
  }
  
  proprietorData.sex = record.Sex?.trim().charAt(0).toUpperCase() + record.Sex?.slice(1).toLowerCase() || 'Male';
  if (!['Male', 'Female'].includes(proprietorData.sex)) proprietorData.sex = 'Male';
  
  proprietorData.email = (!record.Email || record.Email.toLowerCase().includes('blank'))
    ? `${proprietorData.firstName.toLowerCase()}${rowNumber}@napps-nasarawa.edu.ng`
    : record.Email.trim();
  
  proprietorData.phone = record['Phone/Mobile']?.trim() || `+234${Math.random().toString().substring(2, 12)}`;
  
  const nappsReg = record['Are you registered with NAPPs ?'] || '';
  if (nappsReg.toLowerCase().includes('certificate')) {
    proprietorData.nappsRegistered = 'Registered with Certificate';
  } else if (nappsReg.toLowerCase().includes('registered')) {
    proprietorData.nappsRegistered = 'Registered';
  } else {
    proprietorData.nappsRegistered = 'Not Registered';
  }
  
  if (record['tabular_grid']) {
    proprietorData.participationHistory = record['tabular_grid']
      .split('|')
      .map((item: string) => item.trim())
      .filter((item: string) => item);
  }
  
  proprietorData.timesParticipated = parseInt(record['How many times your School participated in Napps Nasarawa State Unified Certificate Examination']) || 0;
  proprietorData.pupilsPresentedLastExam = parseInt(record['Number of Pupils presented in year 2023/2024 NAPPS Nasarawa State certificate examination']) || 0;
  proprietorData.awards = record['Award given to you / your School by NAPPS for the past four years'] || '';
  proprietorData.positionHeld = record['Position Held at NAPPS Level Progressively'] || '';
  
  const regStatus = record['Registeration Status'] || '';
  proprietorData.registrationStatus = regStatus.toLowerCase().includes('registered') ? 'approved' : 'pending';
  
  const approvalStatus = record['Approval Status'] || '';
  proprietorData.approvalStatus = (approvalStatus.toLowerCase().includes('evidence') || approvalStatus.toLowerCase().includes('approve')) ? 'approved' : 'pending';
  
  proprietorData.submissionStatus = 'submitted';
  proprietorData.clearingStatus = 'pending';
  proprietorData.totalAmountDue = 0;
  proprietorData.isActive = true;
  
  const schoolData: any = { isPrimary: true, isActive: true };
  schoolData.schoolName = record['Name Of School']?.trim() || '';
  schoolData.schoolName2 = record['Name Of School 2']?.trim() || '';
  schoolData.address = record.Address?.trim() || '';
  schoolData.lga = record.LGA?.trim() || '';
  schoolData.aeqeoZone = record['AEQEO ZONE']?.trim() || '';
  
  if (record['GPS LONGITUDE']) {
    const longitude = parseFloat(record['GPS LONGITUDE']);
    if (!isNaN(longitude)) schoolData.gpsLongitude = longitude;
  }
  
  if (record['GPS LATITUDE']) {
    const latitude = parseFloat(record['GPS LATITUDE']);
    if (!isNaN(latitude)) schoolData.gpsLatitude = latitude;
  }
  
  const typeOfSchool = normalizeTypeOfSchool(record['Type of School']);
  if (typeOfSchool) {
    schoolData.typeOfSchool = typeOfSchool;
  }

  const categoryOfSchool = record['Category of School']?.trim();
  schoolData.categoryOfSchool = categoryOfSchool || 'Private';

  const ownership = normalizeOwnership(record['Ownsership'] ?? record['Ownership']);
  if (ownership) {
    schoolData.ownership = ownership;
  }
  
  if (record['Year of Establishment']) {
    const year = parseInt(record['Year of Establishment']);
    if (!isNaN(year) && year > 1900 && year < 2100) schoolData.yearOfEstablishment = year;
  }
  
  if (record['Year of Approval']) {
    const year = parseInt(record['Year of Approval']);
    if (!isNaN(year) && year > 1900 && year < 2100) schoolData.yearOfApproval = year;
  }
  
  const enrollment: any = {};
  if (record['KG1/ECCD Male']) enrollment.kg1Male = parseInt(record['KG1/ECCD Male']) || 0;
  if (record['KG1/ECCD Female']) enrollment.kg1Female = parseInt(record['KG1/ECCD Female']) || 0;
  if (record['KG2/ECCD MALE']) enrollment.kg2Male = parseInt(record['KG2/ECCD MALE']) || 0;
  if (record['KG2/ECCD Female']) enrollment.kg2Female = parseInt(record['KG2/ECCD Female']) || 0;
  if (record['NURSERY 1 Male']) enrollment.nursery1Male = parseInt(record['NURSERY 1 Male']) || 0;
  if (record['NURSERY1 Female']) enrollment.nursery1Female = parseInt(record['NURSERY1 Female']) || 0;
  if (record['NURSERY 2 Male']) enrollment.nursery2Male = parseInt(record['NURSERY 2 Male']) || 0;
  if (record['NURSERY 2 Female']) enrollment.nursery2Female = parseInt(record['NURSERY 2 Female']) || 0;
  if (record['PRIMARY 1 Male']) enrollment.primary1Male = parseInt(record['PRIMARY 1 Male']) || 0;
  if (record['PRIMARY 1 Female']) enrollment.primary1Female = parseInt(record['PRIMARY 1 Female']) || 0;
  if (record['PRIMARY 2 Male']) enrollment.primary2Male = parseInt(record['PRIMARY 2 Male']) || 0;
  if (record['PRIMARY 2 Female']) enrollment.primary2Female = parseInt(record['PRIMARY 2 Female']) || 0;
  if (record['PRIMARY 3 Male']) enrollment.primary3Male = parseInt(record['PRIMARY 3 Male']) || 0;
  if (record['PRIMARY 3 Female']) enrollment.primary3Female = parseInt(record['PRIMARY 3 Female']) || 0;
  if (record['PRIMARY 4 Male']) enrollment.primary4Male = parseInt(record['PRIMARY 4 Male']) || 0;
  if (record['PRIMARY 4 Female']) enrollment.primary4Female = parseInt(record['PRIMARY 4 Female']) || 0;
  if (record['PRIMARY 5 Male']) enrollment.primary5Male = parseInt(record['PRIMARY 5 Male']) || 0;
  if (record['PRIMARY 5 Female']) enrollment.primary5Female = parseInt(record['PRIMARY 5 Female']) || 0;
  if (record['PRIMARY 6 Male']) enrollment.primary6Male = parseInt(record['PRIMARY 6 Male']) || 0;
  if (record['PRIMARY 6 Female']) enrollment.primary6Female = parseInt(record['PRIMARY 6 Female']) || 0;
  if (record['JSS1 Male']) enrollment.jss1Male = parseInt(record['JSS1 Male']) || 0;
  if (record['JSS1 Female']) enrollment.jss1Female = parseInt(record['JSS1 Female']) || 0;
  if (record['JSS2 Male']) enrollment.jss2Male = parseInt(record['JSS2 Male']) || 0;
  if (record['JSS2 Female']) enrollment.jss2Female = parseInt(record['JSS2 Female']) || 0;
  if (record['JSS3 Male']) enrollment.jss3Male = parseInt(record['JSS3 Male']) || 0;
  if (record['JSS3 Female']) enrollment.jss3Female = parseInt(record['JSS3 Female']) || 0;
  if (record['SS1 Male']) enrollment.ss1Male = parseInt(record['SS1 Male']) || 0;
  if (record['SS1 Female']) enrollment.ss1Female = parseInt(record['SS1 Female']) || 0;
  if (record['SS2 Male']) enrollment.ss2Male = parseInt(record['SS2 Male']) || 0;
  if (record['SS2 Female']) enrollment.ss2Female = parseInt(record['SS2 Female']) || 0;
  if (record['SS3 Male']) enrollment.ss3Male = parseInt(record['SS3 Male']) || 0;
  if (record['SS3 Female']) enrollment.ss3Female = parseInt(record['SS3 Female']) || 0;
  
  schoolData.enrollment = enrollment;
  return { proprietorData, schoolData };
}

function normalizeTypeOfSchool(value?: string): string | undefined {
  const raw = value?.trim();
  if (!raw) {
    return undefined;
  }

  const normalized = raw.toLowerCase();
  if (normalized.includes('islamiyah')) {
    return 'Islamiyah Integrated';
  }
  if (normalized.includes('faith')) {
    return 'Faith Based';
  }
  if (normalized.includes('conventional') || normalized.includes('regular')) {
    return 'Conventional';
  }
  if (normalized.includes('secular')) {
    return 'Secular';
  }
  if (normalized.includes('other')) {
    return 'Other';
  }

  return undefined;
}

function normalizeOwnership(value?: string): string | undefined {
  const raw = value?.trim();
  if (!raw) {
    return undefined;
  }

  const normalized = raw.toLowerCase();
  if (normalized.includes('individual')) {
    return 'Individual(s)';
  }
  if (normalized.includes('sole')) {
    return 'Sole';
  }
  if (normalized.includes('partner')) {
    return 'Partnership';
  }
  if (normalized.includes('corporate')) {
    return 'Corporate';
  }
  if (normalized.includes('community')) {
    return 'Community';
  }
  if (normalized.includes('religious') || normalized.includes('faith')) {
    return 'Religious Organization';
  }
  if (normalized.includes('ngo')) {
    return 'Other';
  }
  if (normalized.includes('other')) {
    return 'Other';
  }

  return 'Other';
}

async function generateRegistrationNumber(model: Model<any>, count: number): Promise<string> {
  const year = new Date().getFullYear();
  const paddedCount = String(count + 1).padStart(5, '0');
  const regNumber = `NAPPS${year}${paddedCount}`;
  const exists = await model.findOne({ registrationNumber: regNumber });
  if (exists) return generateRegistrationNumber(model, count + 1);
  return regNumber;
}

bootstrap().catch((error) => {
  console.error('❌ Fatal Error:', error);
  process.exit(1);
});