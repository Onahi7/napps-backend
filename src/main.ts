import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: [
        'http://localhost:3000', // Connect Hub
        'http://localhost:3002', // Portal
        'http://localhost:3001', // Backend
        'http://localhost:8080', // Vite dev server
        'https://nappsnasarawa.com',
        'https://portal.nappsnasarawa.com',
        'https://connect.nappsnasarawa.com',
        'https://api.nappsnasarawa.com',
        'https://lovable.dev',
        /\.lovable\.dev$/, // Allow all Lovable preview URLs
        /\.vercel\.app$/, // Allow Vercel preview URLs
        /\.netlify\.app$/, // Allow Netlify preview URLs
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    },
  });

  const configService = app.get(ConfigService);

  // Global API prefix
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  app.setGlobalPrefix(apiPrefix);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('NAPPS Nasarawa API')
    .setDescription('Backend API for NAPPS Nasarawa State portal system')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Authentication', 'User authentication and authorization')
    .addTag('Proprietors', 'School proprietor management')
    .addTag('Schools', 'School information and management')
    .addTag('Payments', 'Payment processing and management')
    .addTag('Members', 'Leadership and member profiles')
    .addTag('Announcements', 'System announcements')
    .addTag('Upload', 'File upload and management')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
    customSiteTitle: 'NAPPS Nasarawa API Documentation',
    customfavIcon: '/favicon.ico',
    customCssUrl: '/swagger-ui-custom.css',
  });

  const port = configService.get<number>('PORT', 3001);
  await app.listen(port);

  console.log(`🚀 NAPPS Nasarawa Backend API is running on: http://localhost:${port}`);
  console.log(`📚 API Documentation available at: http://localhost:${port}/${apiPrefix}/docs`);
  console.log(`🌍 Environment: ${configService.get<string>('NODE_ENV', 'development')}`);
}

bootstrap();
