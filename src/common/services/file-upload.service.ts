import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';

export interface FileUploadResult {
  url: string;
  publicId: string;
  format: string;
  resourceType: string;
  bytes: number;
  width?: number;
  height?: number;
  createdAt: string;
}

export interface FileUploadOptions {
  folder?: string;
  publicId?: string;
  transformation?: any[];
  resourceType?: 'image' | 'video' | 'raw' | 'auto';
  allowedFormats?: string[];
  maxBytes?: number;
  width?: number;
  height?: number;
  crop?: string;
  quality?: string | number;
}

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);

  constructor(private configService: ConfigService) {
    // Configure Cloudinary
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  // =============== IMAGE UPLOADS ===============

  async uploadImage(
    buffer: Buffer,
    options: FileUploadOptions = {},
  ): Promise<FileUploadResult> {
    const {
      folder = 'napps',
      publicId,
      transformation = [],
      allowedFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      maxBytes = 10 * 1024 * 1024, // 10MB default
      width,
      height,
      crop = 'limit',
      quality = 'auto',
    } = options;

    try {
      // Validate file size
      if (buffer.length > maxBytes) {
        throw new BadRequestException(`File size exceeds ${maxBytes / 1024 / 1024}MB limit`);
      }

      const uploadOptions: any = {
        folder,
        resource_type: 'image',
        allowed_formats: allowedFormats,
        transformation: [
          ...transformation,
          ...(width || height ? [{ width, height, crop, quality }] : []),
        ],
      };

      if (publicId) {
        uploadOptions.public_id = publicId;
        uploadOptions.overwrite = true;
      }

      const result: UploadApiResponse = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          uploadOptions,
          (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
            if (error) reject(error);
            else if (result) resolve(result);
            else reject(new Error('Upload failed'));
          },
        ).end(buffer);
      });

      this.logger.log(`Image uploaded successfully: ${result.public_id}`);

      return {
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        resourceType: result.resource_type,
        bytes: result.bytes,
        width: result.width,
        height: result.height,
        createdAt: result.created_at,
      };
    } catch (error) {
      this.logger.error(`Image upload failed: ${error.message}`);
      throw new BadRequestException(`Image upload failed: ${error.message}`);
    }
  }

  // =============== DOCUMENT UPLOADS ===============

  async uploadDocument(
    buffer: Buffer,
    filename: string,
    options: FileUploadOptions = {},
  ): Promise<FileUploadResult> {
    const {
      folder = 'napps/documents',
      publicId,
      allowedFormats = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv'],
      maxBytes = 50 * 1024 * 1024, // 50MB for documents
    } = options;

    try {
      // Validate file size
      if (buffer.length > maxBytes) {
        throw new BadRequestException(`File size exceeds ${maxBytes / 1024 / 1024}MB limit`);
      }

      // Extract file extension
      const fileExtension = filename.split('.').pop()?.toLowerCase();
      if (!fileExtension || !allowedFormats.includes(fileExtension)) {
        throw new BadRequestException(
          `File format not allowed. Supported formats: ${allowedFormats.join(', ')}`,
        );
      }

      const uploadOptions: any = {
        folder,
        resource_type: 'raw',
        public_id: publicId || `document_${Date.now()}`,
        overwrite: !!publicId,
        use_filename: true,
        unique_filename: !publicId,
      };

      const result: UploadApiResponse = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          uploadOptions,
          (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
            if (error) reject(error);
            else if (result) resolve(result);
            else reject(new Error('Upload failed'));
          },
        ).end(buffer);
      });

      this.logger.log(`Document uploaded successfully: ${result.public_id}`);

      return {
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        resourceType: result.resource_type,
        bytes: result.bytes,
        createdAt: result.created_at,
      };
    } catch (error) {
      this.logger.error(`Document upload failed: ${error.message}`);
      throw new BadRequestException(`Document upload failed: ${error.message}`);
    }
  }

  // =============== AVATAR/PROFILE UPLOADS ===============

  async uploadAvatar(buffer: Buffer, userId: string): Promise<FileUploadResult> {
    return this.uploadImage(buffer, {
      folder: 'napps/avatars',
      publicId: `avatar_${userId}`,
      width: 300,
      height: 300,
      crop: 'fill',
      quality: 'auto:good',
      allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
      maxBytes: 5 * 1024 * 1024, // 5MB for avatars
    });
  }

  // =============== TEAM MEMBER PHOTOS ===============

  async uploadTeamPhoto(buffer: Buffer, memberId: string): Promise<FileUploadResult> {
    return this.uploadImage(buffer, {
      folder: 'napps/team',
      publicId: `team_${memberId}`,
      width: 400,
      height: 400,
      crop: 'fill',
      quality: 'auto:good',
      allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
      maxBytes: 8 * 1024 * 1024, // 8MB for team photos
    });
  }

  // =============== HOMEPAGE CONTENT UPLOADS ===============

  async uploadHomepageImage(
    buffer: Buffer,
    imageType: 'hero' | 'leadership' | 'gallery' | 'about',
    identifier?: string,
  ): Promise<FileUploadResult> {
    const folderMap = {
      hero: 'napps/homepage/hero',
      leadership: 'napps/homepage/leadership',
      gallery: 'napps/homepage/gallery',
      about: 'napps/homepage/about',
    };

    const sizeConfig = {
      hero: { width: 1920, height: 1080 },
      leadership: { width: 600, height: 600 },
      gallery: { width: 800, height: 600 },
      about: { width: 1200, height: 800 },
    };

    return this.uploadImage(buffer, {
      folder: folderMap[imageType],
      publicId: identifier ? `${imageType}_${identifier}` : undefined,
      ...sizeConfig[imageType],
      crop: 'fill',
      quality: 'auto:good',
      allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
      maxBytes: 10 * 1024 * 1024, // 10MB for homepage images
    });
  }

  // =============== FILE MANAGEMENT ===============

  async deleteFile(publicId: string, resourceType: 'image' | 'raw' = 'image'): Promise<boolean> {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });

      if (result.result === 'ok') {
        this.logger.log(`File deleted successfully: ${publicId}`);
        return true;
      } else {
        this.logger.warn(`File deletion failed: ${publicId} - ${result.result}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`File deletion error: ${error.message}`);
      throw new BadRequestException(`File deletion failed: ${error.message}`);
    }
  }

  async getFileDetails(publicId: string, resourceType: 'image' | 'raw' = 'image'): Promise<any> {
    try {
      const result = await cloudinary.api.resource(publicId, {
        resource_type: resourceType,
      });

      return {
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        resourceType: result.resource_type,
        bytes: result.bytes,
        width: result.width,
        height: result.height,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      };
    } catch (error) {
      this.logger.error(`Get file details error: ${error.message}`);
      throw new BadRequestException(`Failed to get file details: ${error.message}`);
    }
  }

  // =============== UTILITY METHODS ===============

  generateThumbnail(publicId: string, width: number = 200, height: number = 200): string {
    return cloudinary.url(publicId, {
      width,
      height,
      crop: 'fill',
      quality: 'auto:low',
      format: 'webp',
    });
  }

  generateResponsiveUrls(publicId: string): { [key: string]: string } {
    const sizes = {
      thumbnail: { width: 200, height: 200 },
      small: { width: 400, height: 300 },
      medium: { width: 800, height: 600 },
      large: { width: 1200, height: 900 },
    };

    const urls: { [key: string]: string } = {};

    Object.entries(sizes).forEach(([size, dimensions]) => {
      urls[size] = cloudinary.url(publicId, {
        ...dimensions,
        crop: 'fill',
        quality: 'auto:good',
        format: 'webp',
      });
    });

    return urls;
  }

  // =============== VALIDATION HELPERS ===============

  isValidImageFormat(filename: string): boolean {
    const allowedFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const extension = filename.split('.').pop()?.toLowerCase();
    return extension ? allowedFormats.includes(extension) : false;
  }

  isValidDocumentFormat(filename: string): boolean {
    const allowedFormats = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv'];
    const extension = filename.split('.').pop()?.toLowerCase();
    return extension ? allowedFormats.includes(extension) : false;
  }

  getFileSize(buffer: Buffer): { bytes: number; mb: number; kb: number } {
    const bytes = buffer.length;
    return {
      bytes,
      kb: Math.round(bytes / 1024),
      mb: Math.round(bytes / (1024 * 1024)),
    };
  }
}