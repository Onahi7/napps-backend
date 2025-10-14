import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { User, UserDocument } from '../src/schemas/user.schema';
import { Proprietor, ProprietorDocument } from '../src/schemas/proprietor.schema';
import { School, SchoolDocument } from '../src/schemas/school.schema';
import { FeeConfiguration, FeeConfigurationDocument } from '../src/schemas/fee-configuration.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
  const proprietorModel = app.get<Model<ProprietorDocument>>(getModelToken(Proprietor.name));
  const schoolModel = app.get<Model<SchoolDocument>>(getModelToken(School.name));
  const feeConfigModel = app.get<Model<FeeConfigurationDocument>>(getModelToken(FeeConfiguration.name));

  try {
    console.log('🌱 Starting database seeding...\n');

    // ============================================
    // 1. CREATE ADMIN USERS
    // ============================================
    console.log('👤 Creating admin users...');
    
    // Check if admin already exists
    const existingAdmin = await userModel.findOne({ email: 'admin@nappsnasarawa.com' });
    
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists. Skipping admin creation.');
    } else {
      const adminUsers = [
        {
          email: 'admin@nappsnasarawa.com',
          firstName: 'Super',
          lastName: 'Admin',
          password: 'Admin@123456', // Will be hashed by pre-save hook
          role: 'super_admin',
          appAccess: ['connect_hub', 'portal'],
          isActive: true,
          isEmailVerified: true,
          phone: '+2348012345678',
        },
        {
          email: 'portal.admin@nappsnasarawa.com',
          firstName: 'Portal',
          lastName: 'Administrator',
          password: 'Portal@123456',
          role: 'admin',
          appAccess: ['portal'],
          isActive: true,
          isEmailVerified: true,
          phone: '+2348012345679',
        },
        {
          email: 'connecthub.admin@nappsnasarawa.com',
          firstName: 'Connect Hub',
          lastName: 'Administrator',
          password: 'ConnectHub@123456',
          role: 'admin',
          appAccess: ['connect_hub'],
          isActive: true,
          isEmailVerified: true,
          phone: '+2348012345680',
        },
      ];

      for (const adminData of adminUsers) {
        const admin = await userModel.create(adminData);
        console.log(`✅ Created ${admin.role}: ${admin.email}`);
      }
    }

    // ============================================
    // 2. CREATE SAMPLE PROPRIETORS
    // ============================================
    console.log('\n📚 Creating sample proprietors...');
    
    const existingProprietor = await proprietorModel.findOne({ email: 'ahmed.yakubu@email.com' });
    
    if (existingProprietor) {
      console.log('⚠️  Sample proprietors already exist. Skipping proprietor seeding.');
    } else {
      const sampleProprietors = [
        {
          firstName: 'Ahmed',
          middleName: 'Ibrahim',
          lastName: 'Yakubu',
          email: 'ahmed.yakubu@email.com',
          phone: '+2348123456789',
          sex: 'Male',
          homeAddress: '123 Keffi Road, Lafia, Nasarawa State',
          stateOfOrigin: 'Nasarawa',
          lga: 'Lafia',
          nappsParticipation: 'Registered',
          registrationNumber: 'NAPPS202400001',
          nappsMembershipId: 'NM2024001',
          registrationStatus: 'approved',
          nappsRegistered: 'Registered',
          clearingStatus: 'cleared',
          isActive: true,
          submissionStatus: 'submitted',
          submissionId: 'SUB2024001',
        },
        {
          firstName: 'Fatima',
          middleName: 'Aisha',
          lastName: 'Hassan',
          email: 'fatima.hassan@email.com',
          phone: '+2348123456790',
          sex: 'Female',
          homeAddress: '45 Market Road, Keffi, Nasarawa State',
          stateOfOrigin: 'Nasarawa',
          lga: 'Keffi',
          nappsParticipation: 'Registered',
          registrationNumber: 'NAPPS202400002',
          nappsMembershipId: 'NM2024002',
          registrationStatus: 'approved',
          nappsRegistered: 'Registered with Certificate',
          clearingStatus: 'cleared',
          isActive: true,
          submissionStatus: 'submitted',
          submissionId: 'SUB2024002',
        },
        {
          firstName: 'John',
          middleName: 'Chukwu',
          lastName: 'Okafor',
          email: 'john.okafor@email.com',
          phone: '+2348123456791',
          sex: 'Male',
          homeAddress: '78 Abuja Road, Nasarawa, Nasarawa State',
          stateOfOrigin: 'Nasarawa',
          lga: 'Nasarawa',
          nappsParticipation: 'Planning to Join',
          registrationStatus: 'pending',
          nappsRegistered: 'Not Registered',
          clearingStatus: 'pending',
          isActive: true,
          submissionStatus: 'submitted',
          submissionId: 'SUB2024003',
        },
        {
          firstName: 'Mary',
          middleName: 'Blessing',
          lastName: 'Adamu',
          email: 'mary.adamu@email.com',
          phone: '+2348123456792',
          sex: 'Female',
          homeAddress: '12 Education Avenue, Akwanga, Nasarawa State',
          stateOfOrigin: 'Nasarawa',
          lga: 'Akwanga',
          nappsParticipation: 'Registered',
          registrationNumber: 'NAPPS202400003',
          nappsMembershipId: 'NM2024003',
          registrationStatus: 'approved',
          nappsRegistered: 'Registered',
          clearingStatus: 'outstanding',
          totalAmountDue: 25000,
          isActive: true,
          submissionStatus: 'submitted',
          submissionId: 'SUB2024004',
        },
        {
          firstName: 'Ibrahim',
          middleName: 'Sani',
          lastName: 'Mohammed',
          email: 'ibrahim.mohammed@email.com',
          phone: '+2348123456793',
          sex: 'Male',
          homeAddress: '34 Government House Road, Lafia, Nasarawa State',
          stateOfOrigin: 'Nasarawa',
          lga: 'Lafia',
          nappsParticipation: 'Not Participating',
          registrationStatus: 'rejected',
          nappsRegistered: 'Not Registered',
          clearingStatus: 'pending',
          isActive: false,
          submissionStatus: 'submitted',
          submissionId: 'SUB2024005',
        },
      ];

      const createdProprietors = await proprietorModel.insertMany(sampleProprietors);
      console.log(`✅ Created ${createdProprietors.length} sample proprietors`);

      // ============================================
      // 3. CREATE SAMPLE SCHOOLS
      // ============================================
      console.log('\n🏫 Creating sample schools...');
      
      const sampleSchools = [
        {
          proprietorId: createdProprietors[0]._id,
          schoolName: 'Greenfield Academy',
          address: '123 Keffi Road, Lafia, Nasarawa State',
          lga: 'Lafia',
          categoryOfSchool: 'Private',
          typeOfSchool: 'Conventional',
          ownership: 'Individual(s)',
          yearOfEstablishment: 2010,
          yearOfApproval: 2011,
          enrollment: {
            nursery1Male: 20,
            nursery1Female: 18,
            nursery2Male: 22,
            nursery2Female: 20,
            primary1Male: 25,
            primary1Female: 23,
            primary2Male: 28,
            primary2Female: 26,
            primary3Male: 24,
            primary3Female: 22,
            primary4Male: 26,
            primary4Female: 24,
            primary5Male: 25,
            primary5Female: 27,
            primary6Male: 23,
            primary6Female: 25,
          },
          isActive: true,
        },
        {
          proprietorId: createdProprietors[1]._id,
          schoolName: 'Bright Stars School',
          address: '45 Market Road, Keffi, Nasarawa State',
          lga: 'Keffi',
          categoryOfSchool: 'Private',
          typeOfSchool: 'Conventional',
          ownership: 'Partnership',
          yearOfEstablishment: 2015,
          yearOfApproval: 2016,
          enrollment: {
            nursery1Male: 15,
            nursery1Female: 13,
            nursery2Male: 17,
            nursery2Female: 15,
            primary1Male: 20,
            primary1Female: 18,
            primary2Male: 22,
            primary2Female: 20,
            primary3Male: 21,
            primary3Female: 19,
            primary4Male: 23,
            primary4Female: 21,
            primary5Male: 22,
            primary5Female: 24,
            primary6Male: 20,
            primary6Female: 22,
          },
          isActive: true,
        },
        {
          proprietorId: createdProprietors[2]._id,
          schoolName: 'Excellence Academy',
          address: '78 Abuja Road, Nasarawa, Nasarawa State',
          lga: 'Nasarawa',
          categoryOfSchool: 'Private',
          typeOfSchool: 'Conventional',
          ownership: 'Corporate',
          yearOfEstablishment: 2012,
          yearOfApproval: 2013,
          enrollment: {
            jss1Male: 30,
            jss1Female: 28,
            jss2Male: 32,
            jss2Female: 30,
            jss3Male: 28,
            jss3Female: 26,
            ss1Male: 35,
            ss1Female: 33,
            ss2Male: 30,
            ss2Female: 28,
            ss3Male: 25,
            ss3Female: 23,
          },
          isActive: true,
        },
        {
          proprietorId: createdProprietors[3]._id,
          schoolName: 'Little Angels Nursery & Primary',
          address: '12 Education Avenue, Akwanga, Nasarawa State',
          lga: 'Akwanga',
          categoryOfSchool: 'Private',
          typeOfSchool: 'Faith Based',
          ownership: 'Religious Organization',
          yearOfEstablishment: 2018,
          yearOfApproval: 2019,
          enrollment: {
            nursery1Male: 12,
            nursery1Female: 10,
            nursery2Male: 15,
            nursery2Female: 13,
            primary1Male: 18,
            primary1Female: 16,
            primary2Male: 20,
            primary2Female: 18,
            primary3Male: 17,
            primary3Female: 15,
            primary4Male: 19,
            primary4Female: 17,
            primary5Male: 18,
            primary5Female: 20,
            primary6Male: 16,
            primary6Female: 18,
          },
          isActive: true,
        },
        {
          proprietorId: createdProprietors[4]._id,
          schoolName: 'Future Leaders International School',
          address: '34 Government House Road, Lafia, Nasarawa State',
          lga: 'Lafia',
          categoryOfSchool: 'Private',
          typeOfSchool: 'Conventional',
          ownership: 'Corporate',
          yearOfEstablishment: 2020,
          yearOfApproval: 2021,
          enrollment: {
            nursery1Male: 10,
            nursery1Female: 8,
            nursery2Male: 12,
            nursery2Female: 10,
            primary1Male: 15,
            primary1Female: 13,
            primary2Male: 17,
            primary2Female: 15,
            primary3Male: 16,
            primary3Female: 14,
            primary4Male: 18,
            primary4Female: 16,
            primary5Male: 17,
            primary5Female: 19,
            primary6Male: 15,
            primary6Female: 17,
            jss1Male: 20,
            jss1Female: 18,
            jss2Male: 18,
            jss2Female: 16,
            jss3Male: 16,
            jss3Female: 14,
          },
          isActive: false,
        },
      ];

      const createdSchools = await schoolModel.insertMany(sampleSchools);
      console.log(`✅ Created ${createdSchools.length} sample schools`);

      // Update proprietors with school references
      for (let i = 0; i < createdProprietors.length; i++) {
        await proprietorModel.findByIdAndUpdate(createdProprietors[i]._id, {
          school: createdSchools[i]._id,
        });
      }
      console.log('✅ Linked schools to proprietors');
    }

    // ============================================
    // 4. CREATE FEE CONFIGURATIONS
    // ============================================
    console.log('\n💰 Creating fee configurations...');
    
    const existingFee = await feeConfigModel.findOne({ code: 'ANNUAL_MEMBERSHIP' });
    
    if (existingFee) {
      console.log('⚠️  Fee configurations already exist. Skipping fee seeding.');
    } else {
      const feeConfigurations = [
        {
          code: 'ANNUAL_MEMBERSHIP',
          name: 'Annual Membership Fee',
          description: 'Standard annual membership fee for NAPPS Nasarawa State',
          amount: 25000,
          currency: 'NGN',
          feeType: 'recurring',
          applicableTo: ['all'],
          isActive: true,
          paystackSplitCode: null,
        },
        {
          code: 'REGISTRATION_FEE',
          name: 'New Registration Fee',
          description: 'One-time registration fee for new members',
          amount: 10000,
          currency: 'NGN',
          feeType: 'one-time',
          applicableTo: ['new_members'],
          isActive: true,
          paystackSplitCode: null,
        },
        {
          code: 'CERTIFICATE_FEE',
          name: 'Certificate Fee',
          description: 'Fee for NAPPS membership certificate',
          amount: 5000,
          currency: 'NGN',
          feeType: 'one-time',
          applicableTo: ['certificate_request'],
          isActive: true,
          paystackSplitCode: null,
        },
      ];

      const createdFees = await feeConfigModel.insertMany(feeConfigurations);
      console.log(`✅ Created ${createdFees.length} fee configurations`);
    }

    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n' + '='.repeat(50));
    console.log('📊 SEEDING SUMMARY');
    console.log('='.repeat(50));
    
    const adminCount = await userModel.countDocuments({ role: { $in: ['admin', 'super_admin'] } });
    const proprietorCount = await proprietorModel.countDocuments();
    const schoolCount = await schoolModel.countDocuments();
    const feeCount = await feeConfigModel.countDocuments();
    
    console.log(`✅ Admin Users: ${adminCount}`);
    console.log(`✅ Proprietors: ${proprietorCount}`);
    console.log(`✅ Schools: ${schoolCount}`);
    console.log(`✅ Fee Configurations: ${feeCount}`);
    
    console.log('\n' + '='.repeat(50));
    console.log('🔐 ADMIN CREDENTIALS');
    console.log('='.repeat(50));
    console.log('Super Admin:');
    console.log('  Email: admin@nappsnasarawa.com');
    console.log('  Password: Admin@123456');
    console.log('\nPortal Admin:');
    console.log('  Email: portal.admin@nappsnasarawa.com');
    console.log('  Password: Portal@123456');
    console.log('\nConnect Hub Admin:');
    console.log('  Email: connecthub.admin@nappsnasarawa.com');
    console.log('  Password: ConnectHub@123456');
    console.log('='.repeat(50));
    
    console.log('\n✨ Database seeding completed successfully!\n');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();
