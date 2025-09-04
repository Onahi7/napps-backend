# NAPPS Nasarawa Backend API - Copilot Instructions

## Project Overview
This is a NestJS backend API for the NAPPS (National Association of Proprietors of Private Schools) Nasarawa State portal system. It serves both the Connect Hub (public website) and Portal (proprietor services) applications.

## Technology Stack
- **Backend Framework**: NestJS with TypeScript
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: NextAuth.js
- **Email Service**: Resend
- **File Storage**: Cloudinary
- **Payment Processing**: Paystack with Split Codes
- **API Documentation**: Swagger/OpenAPI

## Architecture
- Modular architecture with separate modules for different business domains
- RESTful API design with proper HTTP status codes
- Database models using Mongoose schemas
- Authentication middleware for protected routes
- File upload handling with Cloudinary integration
- Email templates for notifications
- Payment processing with split codes for revenue sharing

## Key Modules
1. **Auth Module**: NextAuth integration, JWT handling, role-based access
2. **Proprietors Module**: School owner management and records
3. **Schools Module**: School information and enrollment data
4. **Payments Module**: Paystack integration with split codes
5. **Members Module**: Leadership and staff profiles
6. **Announcements Module**: System-wide notifications
7. **Upload Module**: Cloudinary file management
8. **Email Module**: Resend integration for transactional emails

## Development Guidelines
- Use TypeScript strict mode
- Implement proper error handling and validation
- Add comprehensive API documentation
- Follow NestJS best practices and conventions
- Use DTOs for request/response validation
- Implement proper logging and monitoring
- Write unit and integration tests