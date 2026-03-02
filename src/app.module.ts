import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LevyPaymentsModule } from './levy-payments/levy-payments.module';
import { ProprietorsModule } from './proprietors/proprietors.module';
import { AuthModule } from './auth/auth.module';
import { PaymentsModule } from './payments/payments.module';
import { SchoolsModule } from './schools/schools.module';
import { FeesModule } from './fees/fees.module';
import { ConnectHubModule } from './connect-hub/connect-hub.module';

@Module({
  imports: [
    // Configuration module
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // MongoDB connection
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }),
      inject: [ConfigService],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Feature modules
    LevyPaymentsModule,
    ProprietorsModule,
    AuthModule,
    PaymentsModule,
    SchoolsModule,
    FeesModule,
    ConnectHubModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
