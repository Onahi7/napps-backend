# Proprietors Module

## Overview
The Proprietors module is a comprehensive system for managing school proprietors in the NAPPS (Nigeria Association of Private School Proprietors) system. It provides full CRUD operations, advanced search capabilities, CSV import functionality for existing records, and detailed analytics.

## Features

### Core Functionality
- **Create Proprietor**: Register new proprietors with full validation
- **Read Operations**: Retrieve proprietors with filtering, pagination, and search
- **Update Proprietor**: Modify existing proprietor information (Admin only)
- **Delete Proprietor**: Remove proprietor records (Admin only)
- **Record Lookup**: Find proprietors by email, phone, registration number, or membership ID

### Advanced Features
- **CSV Import**: Bulk import existing proprietor records with validation
- **Statistics Dashboard**: Comprehensive analytics and reporting
- **Duplicate Detection**: Automatic detection and handling of duplicate records
- **Status Management**: Track registration, approval, and clearing statuses
- **Payment Tracking**: Monitor outstanding amounts and payment history

## API Endpoints

### Public Endpoints (No Authentication Required)

#### Create Proprietor
```http
POST /proprietors
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Smith",
  "email": "john.smith@email.com",
  "phone": "+2348123456789"
}
```

#### Get All Proprietors
```http
GET /proprietors
GET /proprietors?page=1&limit=10&search=john&registrationStatus=approved
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `search`: Search term (searches across name, email, phone, registration number)
- `registrationStatus`: Filter by registration status (pending, approved, suspended, rejected)
- `nappsRegistered`: Filter by NAPPS registration (Not Registered, Registered, Registered with Certificate)
- `clearingStatus`: Filter by clearing status (pending, cleared, outstanding)
- `isActive`: Filter by active status (true/false)
- `sortBy`: Sort field (firstName, lastName, email, createdAt, totalAmountDue)
- `sortOrder`: Sort direction (asc, desc)

#### Get Single Proprietor
```http
GET /proprietors/:id
```

#### Lookup Proprietors
```http
GET /proprietors/lookup?email=john@email.com
GET /proprietors/lookup?phone=+2348123456789
GET /proprietors/lookup?registrationNumber=NAPPS202400001
GET /proprietors/lookup?nappsMembershipId=NM2024001
```

### Admin Endpoints (Authentication Required)

#### Update Proprietor
```http
PATCH /proprietors/:id
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "registrationStatus": "approved",
  "totalAmountDue": 5000
}
```

#### Delete Proprietor
```http
DELETE /proprietors/:id
Authorization: Bearer {jwt_token}
```

#### Get Statistics
```http
GET /proprietors/stats
Authorization: Bearer {jwt_token}
```

Response:
```json
{
  "total": 1250,
  "byStatus": {
    "approved": 980,
    "pending": 200,
    "suspended": 50,
    "rejected": 20
  },
  "byNappsRegistration": {
    "Registered with Certificate": 500,
    "Registered": 400,
    "Not Registered": 350
  },
  "byClearingStatus": {
    "cleared": 800,
    "outstanding": 300,
    "pending": 150
  },
  "totalAmountDue": 1500000
}
```

#### CSV Import
```http
POST /proprietors/import/csv
Authorization: Bearer {jwt_token}
Content-Type: multipart/form-data

Form Data:
- file: CSV file
- skipValidation: boolean (optional)
- updateExisting: boolean (optional)
```

## Data Schema

### Proprietor Fields
```typescript
{
  firstName: string;           // Required
  middleName?: string;         // Optional
  lastName: string;            // Required  
  sex?: 'Male' | 'Female';     // Optional
  email: string;               // Required, unique
  phone: string;               // Required, unique
  registrationNumber?: string; // Optional, unique, auto-generated
  nappsMembershipId?: string;  // Optional, unique
  registrationStatus: 'pending' | 'approved' | 'suspended' | 'rejected'; // Default: pending
  approvalStatus?: 'pending' | 'approved' | 'rejected'; // Default: pending
  nappsRegistered: 'Not Registered' | 'Registered' | 'Registered with Certificate'; // Default: Not Registered
  participationHistory: object; // Default: {}
  awards?: string;             // Optional
  positionHeld?: string;       // Optional
  clearingStatus: 'pending' | 'cleared' | 'outstanding'; // Default: pending
  totalAmountDue: number;      // Default: 0
  lastPaymentDate?: Date;      // Optional
  submissionId?: string;       // Optional, unique
  submissionDate: Date;        // Default: now
  submissionStatus: 'draft' | 'submitted' | 'processed' | 'archived'; // Default: submitted
  isActive: boolean;           // Default: true
  
  // Virtual fields
  fullName: string;            // Computed from firstName + middleName + lastName
  
  // Timestamps (auto-generated)
  createdAt: Date;
  updatedAt: Date;
}
```

## CSV Import

### CSV Headers
The CSV import supports flexible header formats:

**Required Headers:**
- First Name / firstName / first_name
- Last Name / lastName / last_name  
- Email / email
- Phone / phone / Phone Number

**Optional Headers:**
- Middle Name / middleName / middle_name
- Sex / Gender / sex / gender
- Registration Number / registrationNumber / registration_number
- NAPPS Membership ID / nappsMembershipId / napps_membership_id
- Registration Status / registrationStatus / registration_status
- NAPPS Registered / nappsRegistered / napps_registered
- Awards / awards
- Position Held / positionHeld / position_held
- Clearing Status / clearingStatus / clearing_status
- Total Amount Due / totalAmountDue / total_amount_due

### Import Options
- **skipValidation**: Skip field validation for faster imports (use with caution)
- **updateExisting**: Update existing records if duplicates are found

### Import Results
```json
{
  "totalRecords": 100,
  "successCount": 95,
  "errorCount": 3,
  "skippedCount": 2,
  "errors": [
    {
      "row": 5,
      "field": "email",
      "value": "invalid-email",
      "message": "Invalid email format"
    }
  ],
  "warnings": [
    {
      "row": 10,
      "message": "Proprietor already exists: john@email.com"
    }
  ],
  "summary": {
    "newRecords": 93,
    "updatedRecords": 2,
    "duplicates": 2
  }
}
```

## Search Capabilities

### Full-Text Search
The search functionality looks across multiple fields:
- First Name
- Middle Name  
- Last Name
- Email
- Phone
- Registration Number
- NAPPS Membership ID

### Advanced Filtering
- Registration Status filtering
- NAPPS Registration status filtering
- Clearing status filtering
- Active/Inactive filtering
- Custom date range filtering (via API)

### Sorting Options
- Sort by name (first/last)
- Sort by email
- Sort by creation date
- Sort by total amount due
- Ascending/Descending order

## Validation Rules

### Required Fields
- First Name (2-50 characters)
- Last Name (2-50 characters)
- Email (valid email format, unique)
- Phone (required, unique)

### Optional Field Validation
- Sex: Must be 'Male' or 'Female'
- Registration Status: Must be one of [pending, approved, suspended, rejected]
- NAPPS Registered: Must be one of [Not Registered, Registered, Registered with Certificate]
- Clearing Status: Must be one of [pending, cleared, outstanding]
- Submission Status: Must be one of [draft, submitted, processed, archived]

### Unique Constraints
- Email address
- Phone number  
- Registration Number (when provided)
- NAPPS Membership ID (when provided)
- Submission ID (when provided)

## Error Handling

### Common HTTP Status Codes
- `200 OK`: Successful operation
- `201 Created`: Proprietor successfully created
- `400 Bad Request`: Invalid input data
- `401 Unauthorized`: Authentication required
- `404 Not Found`: Proprietor not found
- `409 Conflict`: Duplicate email/phone/registration number

### Error Response Format
```json
{
  "statusCode": 400,
  "message": "A proprietor with this email already exists",
  "error": "Conflict"
}
```

## Performance Considerations

### Database Indexes
- Email (unique index)
- Phone (unique index)
- Registration Number (sparse unique index)
- NAPPS Membership ID (sparse unique index)
- Registration Status (index)
- Active status (index)
- Creation date (index)

### Pagination
- Default limit: 10 records per page
- Maximum limit: 100 records per page
- Efficient skip-based pagination

### Search Optimization
- Case-insensitive search with regex
- Multiple field search with OR conditions
- Indexed field searches for better performance

## Security Features

### Authentication & Authorization
- Public endpoints: Registration, lookup, basic listing
- Admin-only endpoints: Update, delete, statistics, CSV import
- JWT-based authentication for admin operations

### Input Validation
- Comprehensive DTO validation using class-validator
- SQL injection prevention through Mongoose ODM
- File upload restrictions (CSV only, 10MB max)

### Data Protection
- Email validation and normalization
- Phone number format validation
- Sensitive data handling in imports

## Usage Examples

### JavaScript/TypeScript Client
```javascript
// Create a new proprietor
const proprietor = await fetch('/proprietors', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    firstName: 'John',
    lastName: 'Smith', 
    email: 'john.smith@email.com',
    phone: '+2348123456789'
  })
});

// Search proprietors
const results = await fetch('/proprietors?search=john&page=1&limit=10');

// Lookup by email
const found = await fetch('/proprietors/lookup?email=john@email.com');

// Admin: Update proprietor
const updated = await fetch('/proprietors/123', {
  method: 'PATCH',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-jwt-token'
  },
  body: JSON.stringify({
    registrationStatus: 'approved'
  })
});
```

### CSV Import with cURL
```bash
curl -X POST \
  http://localhost:3000/proprietors/import/csv \
  -H "Authorization: Bearer your-jwt-token" \
  -F "file=@proprietors.csv" \
  -F "updateExisting=true"
```

## Integration with Other Modules

### Authentication Module
- JWT-based authentication for admin operations
- Role-based access control

### Schools Module (Future)
- Link proprietors to their schools
- School ownership tracking

### Payments Module (Future)
- Track payment history
- Outstanding amount management
- Payment notifications

## Testing

### Unit Tests
- Service methods testing
- DTO validation testing
- CSV import functionality
- Search and filtering logic

### Integration Tests  
- API endpoint testing
- Database operations
- File upload testing
- Authentication flows

### Performance Tests
- Large dataset imports
- Search performance with many records
- Pagination efficiency

## Deployment Notes

### Environment Variables
```env
MONGODB_URI=mongodb://localhost:27017/napps
JWT_SECRET=your-jwt-secret
```

### Database Migration
- Run CSV import for existing proprietor data
- Verify data integrity after import
- Set up database indexes for performance

### Monitoring
- Track import success rates
- Monitor search performance
- Log authentication attempts
- Track API usage patterns

## Troubleshooting

### Common Issues

1. **Duplicate Email Error**
   - Check existing records before creation
   - Use update mode in CSV import

2. **CSV Import Failures**
   - Verify CSV format and headers
   - Check data validation errors
   - Review file encoding (use UTF-8)

3. **Search Performance**
   - Ensure database indexes are created
   - Limit search result size
   - Use specific filters to narrow results

4. **Authentication Errors**
   - Verify JWT token validity
   - Check user role permissions
   - Ensure proper Authorization header

### Support
- Check API documentation for endpoint details
- Review error messages for specific issues
- Contact system administrator for access problems
- Use Swagger UI for interactive API testing

---

This module provides a robust foundation for managing proprietors in the NAPPS system, with comprehensive features for data management, import capabilities, and administrative controls.