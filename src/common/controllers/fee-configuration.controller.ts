import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FeeConfigurationService } from '../services/fee-configuration.service';

@ApiTags('Common - Fee Configurations')
@Controller('common/fee-configurations')
export class FeeConfigurationController {
  constructor(private readonly feeConfigService: FeeConfigurationService) {}

  @Get('active')
  @ApiOperation({ 
    summary: 'Get all active fee configurations',
    description: 'Returns all active fees applicable for proprietor registration'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of active fee configurations',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: 'string', example: 'data_capturing' },
          name: { type: 'string', example: 'Data Capturing Fee' },
          amount: { type: 'number', example: 5000 },
          description: { type: 'string', example: 'Fee for digital data capturing and processing' }
        }
      }
    }
  })
  async getActiveFees(@Query('type') type?: string) {
    return this.feeConfigService.getActiveFees(type);
  }

  @Get('calculate')
  @ApiOperation({ 
    summary: 'Calculate total fees with breakdown',
    description: 'Calculate total amount including platform and processing fees'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Fee calculation breakdown'
  })
  async calculateTotalFees(@Query('codes') codes?: string) {
    const feeCodes = codes ? codes.split(',') : undefined;
    return this.feeConfigService.calculateTotalFees(feeCodes);
  }
}
