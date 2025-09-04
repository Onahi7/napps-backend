import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { ProprietorsService } from './proprietors.service';
import { ProprietorsController } from './proprietors.controller';
import { Proprietor, ProprietorSchema } from '../schemas/proprietor.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Proprietor.name, schema: ProprietorSchema },
    ]),
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit for CSV files
      },
      fileFilter: (req, file, callback) => {
        if (
          file.mimetype === 'text/csv' ||
          file.mimetype === 'application/csv' ||
          file.originalname.toLowerCase().endsWith('.csv')
        ) {
          callback(null, true);
        } else {
          callback(new Error('Only CSV files are allowed'), false);
        }
      },
    }),
  ],
  controllers: [ProprietorsController],
  providers: [ProprietorsService],
  exports: [ProprietorsService],
})
export class ProprietorsModule {}