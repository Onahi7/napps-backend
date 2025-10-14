import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { FeeConfigurationService } from './fee-configuration.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import {
  CreateFeeConfigurationDto,
  UpdateFeeConfigurationDto,
  FeeQueryDto,
  FeeCalculationDto,
  BulkFeeUpdateDto,
} from './dto/fee-configuration.dto';
import { FeeConfigurationDocument } from '../schemas/fee-configuration.schema';

@ApiTags('Fee Configuration')
@Controller('fees/configuration')
export class FeeConfigurationController {
  constructor(private readonly feeConfigurationService: FeeConfigurationService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new fee configuration (Admin only)' })
  @ApiResponse({ status: 201, description: 'Fee configuration created successfully' })
  async createFeeConfiguration(
    @Body() createFeeConfigurationDto: CreateFeeConfigurationDto,
    @Request() req: any,
  ): Promise<FeeConfigurationDocument> {
    const userId = req.user?.userId || req.user?.sub;
    return await this.feeConfigurationService.createFeeConfiguration(
      createFeeConfigurationDto,
      userId,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all fee configurations' })
  @ApiResponse({ status: 200, description: 'Fee configurations retrieved successfully' })
  async findAllFeeConfigurations(
    @Query() query: FeeQueryDto,
  ): Promise<FeeConfigurationDocument[]> {
    return await this.feeConfigurationService.findAllFeeConfigurations(query);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get all active fee configurations' })
  @ApiResponse({ status: 200, description: 'Active fee configurations retrieved successfully' })
  async findActiveFeeConfigurations(): Promise<FeeConfigurationDocument[]> {
    return await this.feeConfigurationService.findActiveFeeConfigurations();
  }

  @Get('statistics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get fee configuration statistics (Admin only)' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getFeeStatistics() {
    return await this.feeConfigurationService.getFeeStatistics();
  }

  @Post('calculate')
  @ApiOperation({ summary: 'Calculate total fee amount with breakdown' })
  @ApiResponse({ status: 200, description: 'Fee calculation completed successfully' })
  async calculateFee(@Body() feeCalculationDto: FeeCalculationDto) {
    return await this.feeConfigurationService.calculateFee(feeCalculationDto);
  }

  @Post('bulk-update')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk update fee configurations (Admin only)' })
  @ApiResponse({ status: 200, description: 'Bulk update completed' })
  async bulkUpdateFees(
    @Body() bulkUpdateDto: BulkFeeUpdateDto,
    @Request() req: any,
  ) {
    const userId = req.user?.userId || req.user?.sub;
    return await this.feeConfigurationService.bulkUpdateFees(bulkUpdateDto, userId);
  }

  @Post('seed-defaults')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Seed default fee configurations (Admin only)' })
  @ApiResponse({ status: 200, description: 'Default fees seeded successfully' })
  async seedDefaultFees(): Promise<{ message: string }> {
    await this.feeConfigurationService.seedDefaultFees();
    return { message: 'Default fee configurations seeded successfully' };
  }

  @Get('code/:code')
  @ApiOperation({ summary: 'Get fee configuration by code' })
  @ApiParam({ name: 'code', description: 'Fee code (e.g., membership_fee)' })
  @ApiResponse({ status: 200, description: 'Fee configuration retrieved successfully' })
  async findFeeByCode(@Param('code') code: string): Promise<FeeConfigurationDocument> {
    return await this.feeConfigurationService.findFeeByCode(code);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get fee configuration by ID' })
  @ApiResponse({ status: 200, description: 'Fee configuration retrieved successfully' })
  async findFeeById(@Param('id') id: string): Promise<FeeConfigurationDocument> {
    return await this.feeConfigurationService.findFeeById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update fee configuration (Admin only)' })
  @ApiBody({ type: UpdateFeeConfigurationDto })
  @ApiResponse({ status: 200, description: 'Fee configuration updated successfully' })
  async updateFeeConfiguration(
    @Param('id') id: string,
    @Body() updateFeeConfigurationDto: UpdateFeeConfigurationDto,
    @Request() req: any,
  ): Promise<FeeConfigurationDocument> {
    const userId = req.user?.userId || req.user?.sub;
    return await this.feeConfigurationService.updateFeeConfiguration(
      id,
      updateFeeConfigurationDto,
      userId,
    );
  }

  @Patch(':id/toggle-active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle fee active status (Admin only)' })
  @ApiResponse({ status: 200, description: 'Active status toggled successfully' })
  async toggleActiveStatus(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<FeeConfigurationDocument> {
    const userId = req.user?.userId || req.user?.sub;
    return await this.feeConfigurationService.toggleActiveStatus(id, userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete fee configuration (Admin only)' })
  @ApiResponse({ status: 204, description: 'Fee configuration deleted successfully' })
  async deleteFeeConfiguration(@Param('id') id: string): Promise<void> {
    await this.feeConfigurationService.deleteFeeConfiguration(id);
  }
}
