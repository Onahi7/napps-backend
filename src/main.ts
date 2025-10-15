import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  // Configure CORS using environment variables
  const corsOriginEnv = configService.get<string>('CORS_ORIGIN', 'http://localhost:3000,http://localhost:3001,http://localhost:8081');
  const corsOrigins = corsOriginEnv.split(',').map(origin => origin.trim());
  
  // Enable CORS for configured origins with callback to support preflight and credentials
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (like mobile apps, Postman, or same-origin)
      if (!origin) {
        callback(null, true);
        return;
      }
      
      // Check if origin is in allowed list
      if (corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`⚠️  Origin ${origin} not allowed by CORS. Allowed origins:`, corsOrigins);
        callback(new Error(`Origin ${origin} not allowed by CORS`), false);
      }
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization,Accept',
    optionsSuccessStatus: 200,
  });
  console.log('✅ CORS enabled for origins:', corsOrigins);

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

  const port = process.env.PORT || configService.get<number>('PORT', 3001);
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 NAPPS Nasarawa Backend API is running on: http://0.0.0.0:${port}`);
  console.log(`📚 API Documentation available at: http://0.0.0.0:${port}/${apiPrefix}/docs`);
  console.log(`🌍 Environment: ${configService.get<string>('NODE_ENV', 'development')}`);
}

bootstrap();
