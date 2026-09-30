import { Controller, Get, Post, Body, Param, Query, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { NnsuceService } from './nnsuce.service';
import { CreateCenterDto, RegisterCandidateDto, ProcessOmrScanDto, GenerateExamSheetDto } from './dto/nnsuce.dto';

@ApiTags('NNSUCE Examination')
@Controller('nnsuce')
export class NnsuceController {
  constructor(private readonly nnsuceService: NnsuceService) {}

  @Get('centers')
  @ApiOperation({ summary: 'Get approved NNSUCE examination centers' })
  @ApiQuery({ name: 'lga', required: false })
  async getCenters(@Query('lga') lga?: string) {
    return this.nnsuceService.getCenters(lga);
  }

  @Post('centers')
  @ApiOperation({ summary: 'Create a new NNSUCE examination center' })
  async createCenter(@Body() dto: CreateCenterDto) {
    return this.nnsuceService.createCenter(dto);
  }

  @Get('candidates')
  @ApiOperation({ summary: 'List enrolled NNSUCE candidates' })
  @ApiQuery({ name: 'schoolName', required: false })
  @ApiQuery({ name: 'centerCode', required: false })
  async getCandidates(
    @Query('schoolName') schoolName?: string,
    @Query('centerCode') centerCode?: string,
  ) {
    return this.nnsuceService.getCandidates({ schoolName, centerCode });
  }

  @Post('candidates')
  @ApiOperation({ summary: 'Enroll a new candidate for NNSUCE examination' })
  async registerCandidate(@Body() dto: RegisterCandidateDto) {
    return this.nnsuceService.registerCandidate(dto);
  }

  @Get('exam-sheets/generate')
  @ApiOperation({ summary: 'Generate uniquely customized, anti-tamper OMR examination sheets' })
  @ApiQuery({ name: 'examNumber', required: false })
  @ApiQuery({ name: 'centerCode', required: false })
  @ApiQuery({ name: 'subject', required: false })
  async generateCustomizedSheets(
    @Query('examNumber') examNumber?: string,
    @Query('centerCode') centerCode?: string,
    @Query('subject') subject?: string,
  ) {
    return this.nnsuceService.generateCustomizedSheets({ examNumber, centerCode, subject });
  }

  @Post('omr/process-scan')
  @ApiOperation({ summary: 'Process scanned OMR/OCR answer sheet with AI-assisted marking' })
  async processOmrScan(@Body() dto: ProcessOmrScanDto) {
    return this.nnsuceService.processOmrScan(dto);
  }

  @Get('results')
  @ApiOperation({ summary: 'Get compiled NNSUCE examination results & broadsheet' })
  @ApiQuery({ name: 'centerCode', required: false })
  @ApiQuery({ name: 'schoolName', required: false })
  async getResults(
    @Query('centerCode') centerCode?: string,
    @Query('schoolName') schoolName?: string,
  ) {
    return this.nnsuceService.getResults({ centerCode, schoolName });
  }

  @Get('results/verify/:examNumber')
  @ApiOperation({ summary: 'Public verification of NNSUCE candidate result' })
  async verifyResult(@Param('examNumber') examNumber: string) {
    return this.nnsuceService.verifyResult(examNumber);
  }
}
