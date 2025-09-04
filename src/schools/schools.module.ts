import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SchoolsService } from './schools.service';
import { SchoolsController } from './schools.controller';
import { School, SchoolSchema } from '../schemas/school.schema';
import { Enrollment, EnrollmentSchema } from '../schemas/enrollment.schema';
import { Proprietor, ProprietorSchema } from '../schemas/proprietor.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: School.name, schema: SchoolSchema },
      { name: Enrollment.name, schema: EnrollmentSchema },
      { name: Proprietor.name, schema: ProprietorSchema },
    ]),
  ],
  controllers: [SchoolsController],
  providers: [SchoolsService],
  exports: [SchoolsService],
})
export class SchoolsModule {}