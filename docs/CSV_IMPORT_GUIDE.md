# Proprietors CSV Import Guide

## Overview
The Proprietors module includes a CSV import utility that allows administrators to bulk import existing proprietor records. This feature is designed to help migrate legacy data and streamline the onboarding of existing proprietors.

## CSV Format Requirements

### Required Headers
The CSV file must include the following required columns:
- **First Name**: Proprietor's first name (required)
- **Last Name**: Proprietor's last name (required)
- **Email**: Proprietor's email address (required, must be unique)
- **Phone**: Proprietor's phone number (required, must be unique)

### Optional Headers
The following columns are optional but supported:
- **Middle Name**: Proprietor's middle name
- **Sex**: Gender (Male/Female)
- **Registration Number**: Unique registration number (auto-generated if not provided)
- **NAPPS Membership ID**: NAPPS membership identifier
- **Registration Status**: pending, approved, suspended, rejected (default: pending)
- **NAPPS Registered**: Not Registered, Registered, Registered with Certificate (default: Not Registered)
- **Awards**: Any awards received
- **Position Held**: Current position in school
- **Clearing Status**: pending, cleared, outstanding (default: pending)
- **Total Amount Due**: Outstanding amount owed (default: 0)

### Header Variations
The system accepts multiple header formats for flexibility:
- Case insensitive: "first name", "First Name", "FIRST NAME"
- Underscore format: "first_name", "last_name", "total_amount_due"
- Space format: "First Name", "Last Name", "Total Amount Due"

## Import Options

### Skip Validation
- When enabled, the system skips field validation for faster imports
- Use with caution - invalid data may cause issues later
- Recommended only for trusted data sources

### Update Existing
- When enabled, existing records (matched by email, phone, or registration number) will be updated
- When disabled, duplicate records are skipped and reported as warnings
- Useful for updating existing proprietor information

## Import Process

1. **File Upload**: Upload a CSV file (max 10MB)
2. **Validation**: Each row is validated for required fields and data format
3. **Duplicate Check**: System checks for existing proprietors by email, phone, and registration number
4. **Processing**: New records are created, existing records are updated/skipped based on settings
5. **Results**: Detailed import report with success, error, and warning counts

## Import Results

The import process returns detailed results including:

### Summary Statistics
- Total records processed
- Successfully imported count
- Error count
- Skipped count

### Detailed Breakdown
- New records created
- Existing records updated
- Duplicate records skipped

### Error Reporting
Each error includes:
- Row number in CSV
- Field that caused the error
- Invalid value
- Error message

### Warnings
Warnings are issued for:
- Duplicate records (when update is disabled)
- Missing optional fields
- Data format issues that were auto-corrected

## Sample CSV Template

A sample CSV template is available at `/templates/proprietors-import-template.csv` with the following structure:

```csv
First Name,Middle Name,Last Name,Sex,Email,Phone,Registration Number,NAPPS Membership ID,Registration Status,NAPPS Registered,Awards,Position Held,Clearing Status,Total Amount Due
John,Michael,Smith,Male,john.smith@email.com,+2348123456789,NAPPS202400001,NM2024001,approved,Registered,Best Teacher 2023,Headmaster,cleared,0
```

## API Endpoint

### POST /proprietors/import/csv
- **Authentication**: Required (Admin only)
- **Content-Type**: multipart/form-data
- **Parameters**:
  - `file`: CSV file to import
  - `skipValidation`: Boolean (optional, default: false)
  - `updateExisting`: Boolean (optional, default: false)

### Example Usage with cURL
```bash
curl -X POST \
  http://localhost:3000/proprietors/import/csv \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@proprietors.csv" \
  -F "skipValidation=false" \
  -F "updateExisting=true"
```

## Best Practices

1. **Data Preparation**
   - Clean data before import to minimize errors
   - Ensure email addresses are valid and unique
   - Verify phone numbers are in correct format
   - Use consistent date formats

2. **Testing**
   - Test with a small sample first
   - Review error messages and fix data issues
   - Use validation mode before final import

3. **Backup**
   - Always backup existing data before large imports
   - Consider running imports during low-traffic periods

4. **Monitoring**
   - Review import results carefully
   - Address any errors or warnings
   - Verify data integrity after import

## Error Handling

Common errors and solutions:

### Validation Errors
- **Missing required field**: Ensure all required columns are present
- **Invalid email format**: Check email format (must contain @ and valid domain)
- **Duplicate email/phone**: Handle duplicates or enable update mode

### Data Format Errors
- **Invalid gender**: Must be "Male" or "Female"
- **Invalid status values**: Check enum values match accepted options
- **Invalid numbers**: Ensure numeric fields contain valid numbers

### File Errors
- **File too large**: Max 10MB limit
- **Invalid file type**: Only CSV files are accepted
- **Encoding issues**: Use UTF-8 encoding

## Security Considerations

- CSV import is restricted to authenticated administrators only
- File uploads are limited to 10MB and CSV format only
- Input validation is performed on all data fields
- Duplicate detection prevents data corruption
- All import activities are logged for audit purposes

## Performance Notes

- Large imports (>1000 records) may take several minutes
- Progress is tracked and reported in the response
- Memory usage is optimized through streaming processing
- Consider breaking very large files into smaller chunks

## Support

For technical support or questions about CSV import:
1. Check the error messages in the import results
2. Refer to this documentation
3. Contact the system administrator
4. Review server logs for detailed error information