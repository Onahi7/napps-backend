import { Controller, Get, Param, Res } from '@nestjs/common';
import { AppService } from './app.service';
import type { Response } from 'express';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(): { status: string; timestamp: string; uptime: number } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get('placeholder/:width/:height')
  getPlaceholderImage(
    @Param('width') width: string,
    @Param('height') height: string,
    @Res() res: Response,
  ) {
    // Generate SVG placeholder image
    const w = parseInt(width) || 256;
    const h = parseInt(height) || 256;
    
    const svg = `
      <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f0f0f0"/>
        <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="16" fill="#666" text-anchor="middle" dy=".3em">
          ${w}×${h}
        </text>
      </svg>
    `;
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(svg);
  }
}
