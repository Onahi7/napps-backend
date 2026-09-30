import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConnectHubService } from './connect-hub.service';

@Injectable()
export class ConnectHubSeederService implements OnModuleInit {
  constructor(private readonly connectHubService: ConnectHubService) {}

  async onModuleInit() {
    // Disable automatic seeding to prevent memory issues on startup
    // Run seeding manually via API endpoint when needed
    console.log('✅ Connect Hub Seeder Service initialized (auto-seeding disabled)');
  }

  async seedInitialData() {
    try {
      // Seed site settings
      await this.seedSiteSettings();
      
      // Seed hero images
      await this.seedHeroImages();
      
      // Seed members
      await this.seedMembers();
      
      // Seed announcements
      await this.seedAnnouncements();
      
      console.log('✅ Connect Hub initial data seeded successfully');
    } catch (error) {
      console.log('ℹ️  Connect Hub data already exists or seeding skipped');
    }
  }

  private async seedSiteSettings() {
    const settings = [
      {
        settingKey: 'site_title',
        settingValue: 'NAPPS Nasarawa State - Connect Hub',
        settingType: 'text',
        description: 'Main site title for Connect Hub',
        isPublic: true
      },
      {
        settingKey: 'site_description',
        settingValue: 'Official NAPPS Nasarawa State Connect Hub - Connecting private schools, educational stakeholders, and the community.',
        settingType: 'textarea',
        description: 'Main site description for SEO',
        isPublic: true
      },
      {
        settingKey: 'contact_email',
        settingValue: 'info@nappsnasarawa.com',
        settingType: 'text',
        description: 'Primary contact email',
        isPublic: true
      },
      {
        settingKey: 'contact_phone',
        settingValue: '+234 XXX XXX XXXX',
        settingType: 'text',
        description: 'Primary contact phone',
        isPublic: true
      },
      {
        settingKey: 'office_address',
        settingValue: 'NAPPS Secretariat, Nasarawa State, Nigeria',
        settingType: 'text',
        description: 'Office address',
        isPublic: true
      }
    ];

    for (const setting of settings) {
      try {
        await this.connectHubService.createSiteSetting(setting as any);
      } catch (error) {
        // Setting might already exist
      }
    }
  }

  private async seedHeroImages() {
    const heroImages = [
      {
        title: 'Welcome to NAPPS Nasarawa',
        description: 'Transforming education through collaboration and excellence',
        imageUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80',
        displayOrder: 1,
        isActive: true,
        buttonText: 'Learn More',
        buttonLink: '/about'
      },
      {
        title: 'Quality Education Standards',
        description: 'Setting the benchmark for private school excellence in Nasarawa State',
        imageUrl: 'https://images.unsplash.com/photo-1497486751825-1233686d5d80?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2069&q=80',
        displayOrder: 2,
        isActive: true,
        buttonText: 'Join Us',
        buttonLink: '/membership'
      },
      {
        title: 'Building Future Leaders',
        description: 'Empowering students and educators for tomorrow\'s challenges',
        imageUrl: 'https://images.unsplash.com/photo-1571260899304-425eee4c7efc?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80',
        displayOrder: 3,
        isActive: true,
        buttonText: 'Get Started',
        buttonLink: '/contact'
      }
    ];

    for (const heroImage of heroImages) {
      try {
        await this.connectHubService.createHeroImage(heroImage);
      } catch (error) {
        // Hero image might already exist
      }
    }
  }

  private async seedMembers() {
    const members = [
      {
        name: 'State Chairman',
        position: 'State Chairman',
        bio: 'Executive Chairman, National Association of Proprietors of Private Schools (NAPPS), Nasarawa State Chapter.',
        imageUrl: '/placeholder.svg',
        displayOrder: 1,
        isActive: true,
        email: 'chairman@nappsnasarawa.com',
        socialMedia: {
          linkedin: '',
          twitter: '',
          facebook: ''
        }
      },
      {
        name: 'Secretary General',
        position: 'Secretary General',
        bio: 'Secretariat Administration, NAPPS Nasarawa State Chapter.',
        imageUrl: '/placeholder.svg',
        displayOrder: 2,
        isActive: true,
        email: 'secretary@nappsnasarawa.com',
        socialMedia: {
          linkedin: '',
          twitter: '',
          facebook: ''
        }
      },
      {
        name: 'Academic Director',
        position: 'Academic Director',
        bio: 'Academic Directorate & Examination Board, NAPPS Nasarawa State Chapter.',
        imageUrl: '/placeholder.svg',
        displayOrder: 3,
        isActive: true,
        email: 'academic@nappsnasarawa.com',
        socialMedia: {
          linkedin: '',
          twitter: '',
          facebook: ''
        }
      },
      {
        name: 'State Treasurer',
        position: 'Treasurer',
        bio: 'Treasury & Financial Administration, NAPPS Nasarawa State Chapter.',
        imageUrl: '/placeholder.svg',
        displayOrder: 4,
        isActive: true,
        email: 'treasurer@nappsnasarawa.com',
        socialMedia: {
          linkedin: '',
          twitter: '',
          facebook: ''
        }
      }
    ];

    for (const member of members) {
      try {
        await this.connectHubService.createMember(member);
      } catch (error) {
        // Member might already exist
      }
    }
  }

  private async seedAnnouncements() {
    const announcements = [
      {
        title: 'Welcome to NAPPS Connect Hub',
        message: 'Discover the official portal for NAPPS Nasarawa State. Connect with fellow educators, access resources, and stay updated with the latest developments.',
        type: 'info',
        isActive: true,
        showOnAllPages: true,
        backgroundColor: '#1e40af',
        textColor: '#ffffff',
        displayOrder: 1
      }
    ];

    for (const announcement of announcements) {
      try {
        await this.connectHubService.createAnnouncement(announcement as any);
      } catch (error) {
        // Announcement might already exist
      }
    }
  }
}