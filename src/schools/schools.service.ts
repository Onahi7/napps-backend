import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, SortOrder } from 'mongoose';
import { School, SchoolDocument } from '../schemas/school.schema';
import { Enrollment, EnrollmentDocument } from '../schemas/enrollment.schema';
import { Proprietor, ProprietorDocument } from '../schemas/proprietor.schema';
import { 
  CreateSchoolDto, 
  UpdateSchoolDto, 
  SchoolQueryDto,
  CreateEnrollmentDto,
  UpdateEnrollmentDto,
  EnrollmentQueryDto
} from './dto/school.dto';

@Injectable()
export class SchoolsService {
  constructor(
    @InjectModel(School.name) private schoolModel: Model<SchoolDocument>,
    @InjectModel(Enrollment.name) private enrollmentModel: Model<EnrollmentDocument>,
    @InjectModel(Proprietor.name) private proprietorModel: Model<ProprietorDocument>,
  ) {}

  // =============== SCHOOL MANAGEMENT ===============

  async createSchool(createSchoolDto: CreateSchoolDto): Promise<SchoolDocument> {
    try {
      // Verify proprietor exists
      const proprietor = await this.proprietorModel.findById(createSchoolDto.proprietorId);
      if (!proprietor) {
        throw new NotFoundException('Proprietor not found');
      }

      // If this is marked as primary, ensure no other primary school exists for this proprietor
      if (createSchoolDto.isPrimary) {
        await this.schoolModel.updateMany(
          { proprietorId: createSchoolDto.proprietorId },
          { isPrimary: false }
        );
      }

      const school = new this.schoolModel(createSchoolDto);
      return await school.save();
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to create school');
    }
  }

  async findAllSchools(query: SchoolQueryDto): Promise<{
    data: SchoolDocument[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    }
  }> {
    const {
      page = 1,
      limit = 10,
      search,
      proprietorId,
      lga,
      aeqeoZone,
      typeOfSchool,
      categoryOfSchool,
      isActive,
      isPrimary,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = query;

    // Build filter query
    const filter: FilterQuery<SchoolDocument> = {};

    if (search) {
      filter.$or = [
        { schoolName: { $regex: search, $options: 'i' } },
        { schoolName2: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
        { addressLine2: { $regex: search, $options: 'i' } },
      ];
    }

    if (proprietorId) filter.proprietorId = proprietorId;
    if (lga) filter.lga = { $regex: lga, $options: 'i' };
    if (aeqeoZone) filter.aeqeoZone = { $regex: aeqeoZone, $options: 'i' };
    if (typeOfSchool) filter.typeOfSchool = { $regex: typeOfSchool, $options: 'i' };
    if (categoryOfSchool) filter.categoryOfSchool = { $regex: categoryOfSchool, $options: 'i' };
    if (typeof isActive === 'boolean') filter.isActive = isActive;
    if (typeof isPrimary === 'boolean') filter.isPrimary = isPrimary;

    // Build sort object
    const sort: { [key: string]: SortOrder } = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const skip = (page - 1) * limit;
    
    const [data, total] = await Promise.all([
      this.schoolModel
        .find(filter)
        .populate('proprietorId', 'firstName lastName email phone registrationNumber')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.schoolModel.countDocuments(filter),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findSchoolById(id: string): Promise<SchoolDocument> {
    const school = await this.schoolModel
      .findById(id)
      .populate('proprietorId', 'firstName lastName email phone registrationNumber');
    
    if (!school) {
      throw new NotFoundException(`School with ID ${id} not found`);
    }
    
    return school;
  }

  async findSchoolsByProprietor(proprietorId: string): Promise<SchoolDocument[]> {
    return await this.schoolModel
      .find({ proprietorId, isActive: true })
      .populate('proprietorId', 'firstName lastName email phone registrationNumber');
  }

  async updateSchool(id: string, updateSchoolDto: UpdateSchoolDto): Promise<SchoolDocument> {
    try {
      // If setting as primary, ensure no other primary school exists for this proprietor
      if (updateSchoolDto.isPrimary) {
        const existingSchool = await this.schoolModel.findById(id);
        if (existingSchool) {
          await this.schoolModel.updateMany(
            { proprietorId: existingSchool.proprietorId, _id: { $ne: id } },
            { isPrimary: false }
          );
        }
      }

      const school = await this.schoolModel.findByIdAndUpdate(
        id,
        updateSchoolDto,
        { new: true, runValidators: true }
      ).populate('proprietorId', 'firstName lastName email phone registrationNumber');
      
      if (!school) {
        throw new NotFoundException(`School with ID ${id} not found`);
      }
      
      return school;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to update school');
    }
  }

  async deleteSchool(id: string): Promise<void> {
    const school = await this.schoolModel.findById(id);
    if (!school) {
      throw new NotFoundException(`School with ID ${id} not found`);
    }

    // Check if there are enrollments associated with this school
    const enrollmentCount = await this.enrollmentModel.countDocuments({ schoolId: id });
    if (enrollmentCount > 0) {
      throw new BadRequestException(
        'Cannot delete school with existing enrollment records. Please archive enrollments first.'
      );
    }

    await this.schoolModel.findByIdAndDelete(id);
  }

  // =============== ENROLLMENT MANAGEMENT ===============

  async createEnrollment(createEnrollmentDto: CreateEnrollmentDto): Promise<EnrollmentDocument> {
    try {
      // Verify school and proprietor exist
      const [school, proprietor] = await Promise.all([
        this.schoolModel.findById(createEnrollmentDto.schoolId),
        this.proprietorModel.findById(createEnrollmentDto.proprietorId),
      ]);

      if (!school) {
        throw new NotFoundException('School not found');
      }
      if (!proprietor) {
        throw new NotFoundException('Proprietor not found');
      }

      // Check for existing enrollment in same academic year and term
      const existing = await this.enrollmentModel.findOne({
        schoolId: createEnrollmentDto.schoolId,
        academicYear: createEnrollmentDto.academicYear,
        term: createEnrollmentDto.term,
      });

      if (existing) {
        throw new ConflictException(
          `Enrollment already exists for ${createEnrollmentDto.academicYear} - ${createEnrollmentDto.term} term`
        );
      }

      const enrollment = new this.enrollmentModel(createEnrollmentDto);
      return await enrollment.save();
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to create enrollment');
    }
  }

  async findAllEnrollments(query: EnrollmentQueryDto): Promise<{
    data: EnrollmentDocument[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    }
  }> {
    const {
      page = 1,
      limit = 10,
      schoolId,
      proprietorId,
      academicYear,
      term,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = query;

    // Build filter query
    const filter: FilterQuery<EnrollmentDocument> = {};

    if (schoolId) filter.schoolId = schoolId;
    if (proprietorId) filter.proprietorId = proprietorId;
    if (academicYear) filter.academicYear = academicYear;
    if (term) filter.term = term;
    if (status) filter.status = status;

    // Build sort object
    const sort: { [key: string]: SortOrder } = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const skip = (page - 1) * limit;
    
    const [data, total] = await Promise.all([
      this.enrollmentModel
        .find(filter)
        .populate('schoolId', 'schoolName address proprietorId')
        .populate('proprietorId', 'firstName lastName email phone')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.enrollmentModel.countDocuments(filter),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findEnrollmentById(id: string): Promise<EnrollmentDocument> {
    const enrollment = await this.enrollmentModel
      .findById(id)
      .populate('schoolId', 'schoolName address proprietorId')
      .populate('proprietorId', 'firstName lastName email phone');
    
    if (!enrollment) {
      throw new NotFoundException(`Enrollment with ID ${id} not found`);
    }
    
    return enrollment;
  }

  async updateEnrollment(id: string, updateEnrollmentDto: UpdateEnrollmentDto): Promise<EnrollmentDocument> {
    try {
      const enrollment = await this.enrollmentModel.findByIdAndUpdate(
        id,
        updateEnrollmentDto,
        { new: true, runValidators: true }
      )
      .populate('schoolId', 'schoolName address proprietorId')
      .populate('proprietorId', 'firstName lastName email phone');
      
      if (!enrollment) {
        throw new NotFoundException(`Enrollment with ID ${id} not found`);
      }
      
      return enrollment;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to update enrollment');
    }
  }

  async deleteEnrollment(id: string): Promise<void> {
    const result = await this.enrollmentModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException(`Enrollment with ID ${id} not found`);
    }
  }

  async submitEnrollment(id: string): Promise<EnrollmentDocument> {
    const enrollment = await this.enrollmentModel.findById(id);
    if (!enrollment) {
      throw new NotFoundException(`Enrollment with ID ${id} not found`);
    }

    if (enrollment.status !== 'draft') {
      throw new BadRequestException('Only draft enrollments can be submitted');
    }

    enrollment.status = 'submitted';
    enrollment.submittedAt = new Date();
    
    return await enrollment.save();
  }

  // =============== ANALYTICS & STATISTICS ===============

  async getSchoolStats(): Promise<{
    totalSchools: number;
    activeSchools: number;
    schoolsByLGA: Record<string, number>;
    schoolsByType: Record<string, number>;
    schoolsByCategory: Record<string, number>;
    averageYearEstablished: number;
  }> {
    const [
      totalSchools,
      activeSchools,
      lgaStats,
      typeStats,
      categoryStats,
      yearStats
    ] = await Promise.all([
      this.schoolModel.countDocuments(),
      this.schoolModel.countDocuments({ isActive: true }),
      this.schoolModel.aggregate([
        { $match: { isActive: true, lga: { $exists: true, $ne: null } } },
        { $group: { _id: '$lga', count: { $sum: 1 } } }
      ]),
      this.schoolModel.aggregate([
        { $match: { isActive: true, typeOfSchool: { $exists: true, $ne: null } } },
        { $group: { _id: '$typeOfSchool', count: { $sum: 1 } } }
      ]),
      this.schoolModel.aggregate([
        { $match: { isActive: true, categoryOfSchool: { $exists: true, $ne: null } } },
        { $group: { _id: '$categoryOfSchool', count: { $sum: 1 } } }
      ]),
      this.schoolModel.aggregate([
        { $match: { isActive: true, yearOfEstablishment: { $exists: true, $ne: null } } },
        { $group: { _id: null, avgYear: { $avg: '$yearOfEstablishment' } } }
      ])
    ]);

    return {
      totalSchools,
      activeSchools,
      schoolsByLGA: lgaStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      schoolsByType: typeStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      schoolsByCategory: categoryStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      averageYearEstablished: Math.round(yearStats[0]?.avgYear || 0),
    };
  }

  async getEnrollmentStats(academicYear?: string): Promise<{
    totalEnrollments: number;
    totalStudents: number;
    enrollmentsByTerm: Record<string, number>;
    enrollmentsByStatus: Record<string, number>;
    genderBreakdown: { male: number; female: number };
    staffSummary: {
      totalTeachingStaff: number;
      totalNonTeachingStaff: number;
      qualifiedTeachers: number;
      unqualifiedTeachers: number;
    };
    levelDistribution: Record<string, number>;
  }> {
    const filter: FilterQuery<EnrollmentDocument> = { isActive: true };
    if (academicYear) filter.academicYear = academicYear;

    const [
      totalEnrollments,
      termStats,
      statusStats,
      aggregatedData
    ] = await Promise.all([
      this.enrollmentModel.countDocuments(filter),
      this.enrollmentModel.aggregate([
        { $match: filter },
        { $group: { _id: '$term', count: { $sum: 1 } } }
      ]),
      this.enrollmentModel.aggregate([
        { $match: filter },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      this.enrollmentModel.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalStudents: { $sum: '$totalEnrollment' },
            totalMale: { $sum: '$genderBreakdown.male' },
            totalFemale: { $sum: '$genderBreakdown.female' },
            totalTeaching: { $sum: '$staffData.teachingStaff' },
            totalNonTeaching: { $sum: '$staffData.nonTeachingStaff' },
            totalQualified: { $sum: '$staffData.qualifiedTeachers' },
            totalUnqualified: { $sum: '$staffData.unqualifiedTeachers' },
          }
        }
      ])
    ]);

    const summary = aggregatedData[0] || {};

    return {
      totalEnrollments,
      totalStudents: summary.totalStudents || 0,
      enrollmentsByTerm: termStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      enrollmentsByStatus: statusStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      genderBreakdown: {
        male: summary.totalMale || 0,
        female: summary.totalFemale || 0,
      },
      staffSummary: {
        totalTeachingStaff: summary.totalTeaching || 0,
        totalNonTeachingStaff: summary.totalNonTeaching || 0,
        qualifiedTeachers: summary.totalQualified || 0,
        unqualifiedTeachers: summary.totalUnqualified || 0,
      },
      levelDistribution: await this.getLevelDistribution(filter),
    };
  }

  private async getLevelDistribution(filter: FilterQuery<EnrollmentDocument>): Promise<Record<string, number>> {
    const enrollments = await this.enrollmentModel.find(filter);
    const distribution: Record<string, number> = {};

    for (const enrollment of enrollments) {
      if (enrollment.enrollmentByLevel) {
        Object.entries(enrollment.enrollmentByLevel).forEach(([level, count]) => {
          distribution[level] = (distribution[level] || 0) + (count || 0);
        });
      }
    }

    return distribution;
  }
}