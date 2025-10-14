# Fee Configuration System

## Overview

The Fee Configuration System allows administrators to dynamically manage payment fees, structures, and splits without modifying code. This provides flexibility for configuring different types of fees, their amounts, processing charges, and revenue sharing.

## Features

✅ **Dynamic Fee Configuration** - Create and manage multiple fee types
✅ **Automatic Fee Calculation** - Calculate platform fees, processing fees, and revenue splits
✅ **Split Payment Support** - Configure revenue sharing with Paystack subaccounts
✅ **Bulk Operations** - Update multiple fee configurations at once
✅ **Fee Validation** - Enforce minimum/maximum amounts and payment rules
✅ **Active/Inactive Status** - Enable or disable fee configurations
✅ **Recurring Fees** - Support for monthly, quarterly, and annual fees
✅ **Fee Statistics** - Track fee configuration metrics

## API Endpoints

### Admin Endpoints (Requires JWT + Admin Role)

#### 1. Create Fee Configuration
```http
POST /fees/configuration
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Membership Fee",
  "code": "membership_fee",
  "amount": 5000,
  "description": "Annual NAPPS membership fee",
  "feeStructure": {
    "platformFeePercentage": 2,
    "platformFeeFixed": 0,
    "processingFeePercentage": 1.5,
    "processingFeeCap": 200000,
    "nappsSharePercentage": 10,
    "nappsShareFixed": 0
  },
  "splitConfiguration": [
    {
      "subaccount": "ACCT_xxxxxxxxxxxxx",
      "percentage": 80,
      "description": "Proprietor share"
    },
    {
      "subaccount": "ACCT_yyyyyyyyyyyyy",
      "percentage": 20,
      "description": "NAPPS association share"
    }
  ],
  "isActive": true,
  "isRecurring": true,
  "recurringInterval": "annually",
  "status": "required",
  "minimumAmount": 5000,
  "allowPartialPayment": false
}
```

#### 2. Update Fee Configuration
```http
PATCH /fees/configuration/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "amount": 6000,
  "description": "Updated membership fee",
  "feeStructure": {
    "platformFeePercentage": 2.5
  }
}
```

#### 3. Toggle Active Status
```http
PATCH /fees/configuration/:id/toggle-active
Authorization: Bearer {token}
```

#### 4. Bulk Update Fees
```http
POST /fees/configuration/bulk-update
Authorization: Bearer {token}
Content-Type: application/json

{
  "feeIds": ["fee_id_1", "fee_id_2", "fee_id_3"],
  "isActive": true,
  "feeStructure": {
    "processingFeePercentage": 1.5
  }
}
```

#### 5. Delete Fee Configuration
```http
DELETE /fees/configuration/:id
Authorization: Bearer {token}
```

#### 6. Get Fee Statistics
```http
GET /fees/configuration/statistics
Authorization: Bearer {token}
```

Response:
```json
{
  "totalConfigurations": 8,
  "activeConfigurations": 6,
  "inactiveConfigurations": 2,
  "recurringFees": 3,
  "requiredFees": 5,
  "optionalFees": 3,
  "averageAmount": 7500,
  "totalConfiguredAmount": 60000
}
```

#### 7. Seed Default Fees
```http
POST /fees/configuration/seed-defaults
Authorization: Bearer {token}
```

### Public Endpoints (No Authentication Required)

#### 8. Get All Fee Configurations
```http
GET /fees/configuration?isActive=true&status=required&search=membership
```

Query Parameters:
- `code` - Filter by fee code
- `isActive` - Filter by active status (true/false)
- `isRecurring` - Filter by recurring status (true/false)
- `status` - Filter by status (required/optional)
- `search` - Search in name and description

#### 9. Get Active Fee Configurations
```http
GET /fees/configuration/active
```

Returns only active fees within their validity period.

#### 10. Get Fee by ID
```http
GET /fees/configuration/:id
```

#### 11. Get Fee by Code
```http
GET /fees/configuration/code/membership_fee
```

#### 12. Calculate Fee
```http
POST /fees/configuration/calculate
Content-Type: application/json

{
  "feeCode": "membership_fee",
  "customAmount": 5000
}
```

Response:
```json
{
  "feeConfiguration": { /* full config */ },
  "baseAmount": 5000,
  "baseAmountKobo": 500000,
  "platformFee": 10000,
  "processingFee": 7500,
  "nappsFee": 50000,
  "totalFees": 67500,
  "totalAmount": 567500,
  "breakdown": {
    "baseAmount": "₦5,000",
    "platformFee": "₦100",
    "processingFee": "₦75",
    "nappsFee": "₦500",
    "totalFees": "₦675",
    "totalAmount": "₦5,675"
  }
}
```

## Fee Configuration Schema

```typescript
{
  name: string;                    // Display name
  code: string;                    // Unique identifier (enum)
  amount: number;                  // Base amount in Naira
  description?: string;            // Optional description
  
  feeStructure: {
    platformFeePercentage: number; // Platform % fee (0-100)
    platformFeeFixed: number;      // Platform fixed fee (kobo)
    processingFeePercentage: number; // Paystack % fee (default 1.5%)
    processingFeeCap: number;      // Max processing fee (kobo)
    nappsSharePercentage: number;  // NAPPS % share (0-100)
    nappsShareFixed: number;       // NAPPS fixed share (kobo)
  };
  
  splitConfiguration: [{
    subaccount: string;            // Paystack subaccount code
    percentage: number;            // Share percentage (0-100)
    description?: string;          // Split description
  }];
  
  isActive: boolean;               // Enable/disable fee
  isRecurring: boolean;            // Is this recurring?
  recurringInterval?: string;      // monthly/quarterly/annually
  dueDate?: Date;                  // When fee is due
  status: string;                  // required/optional
  
  minimumAmount: number;           // Min amount (Naira)
  maximumAmount?: number;          // Max amount (Naira)
  allowPartialPayment: boolean;    // Allow partial payments
  
  validFrom?: Date;                // Valid from date
  validUntil?: Date;               // Valid until date
  
  metadata?: object;               // Additional data
  lastModifiedBy?: string;         // Admin user ID
}
```

## Available Fee Types (Codes)

```typescript
enum FeeType {
  MEMBERSHIP_FEE = 'membership_fee',
  REGISTRATION_FEE = 'registration_fee',
  CONFERENCE_FEE = 'conference_fee',
  WORKSHOP_FEE = 'workshop_fee',
  CERTIFICATION_FEE = 'certification_fee',
  ANNUAL_DUES = 'annual_dues',
  NAPPS_DUES = 'napps_dues',
  DIGITAL_CAPTURING = 'digital_capturing',
  OTHER = 'other'
}
```

## Integration with Payment System

The payment initialization automatically integrates with fee configurations:

```typescript
// When initializing payment
POST /payments/initialize
{
  "proprietorId": "...",
  "email": "user@example.com",
  "amount": 5000,
  "paymentType": "membership_fee", // Uses fee configuration
  // ...
}

// The system will:
// 1. Look up fee configuration for "membership_fee"
// 2. Apply configured fee structure
// 3. Calculate platform fees, processing fees, NAPPS share
// 4. Apply split configuration if set
// 5. Initialize payment with Paystack
```

## Usage Examples

### Example 1: Creating a Registration Fee

```bash
curl -X POST http://localhost:3000/fees/configuration \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "School Registration Fee",
    "code": "registration_fee",
    "amount": 10000,
    "description": "One-time school registration",
    "feeStructure": {
      "platformFeePercentage": 3,
      "processingFeePercentage": 1.5,
      "nappsSharePercentage": 15
    },
    "status": "required",
    "minimumAmount": 10000,
    "allowPartialPayment": false
  }'
```

### Example 2: Calculating Total Fee

```bash
curl -X POST http://localhost:3000/fees/configuration/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "feeCode": "registration_fee",
    "customAmount": 10000
  }'
```

### Example 3: Getting Active Fees for Display

```bash
curl http://localhost:3000/fees/configuration/active
```

### Example 4: Updating Multiple Fees

```bash
curl -X POST http://localhost:3000/fees/configuration/bulk-update \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "feeIds": ["fee1_id", "fee2_id"],
    "feeStructure": {
      "processingFeePercentage": 2.0
    }
  }'
```

## Default Fees Seeded

When running seed-defaults, these fees are created:

1. **Membership Fee** - ₦5,000 (Annual, Required)
2. **Registration Fee** - ₦10,000 (One-time, Required)
3. **Digital Capturing** - ₦3,000 (Optional)

## Fee Calculation Logic

```
Base Amount: ₦5,000 (500,000 kobo)

Platform Fee:
  - Fixed: 0 kobo
  - Percentage: 2% of 500,000 = 10,000 kobo
  - Total: 10,000 kobo (₦100)

Processing Fee (Paystack):
  - Percentage: 1.5% of 500,000 = 7,500 kobo
  - Cap: 200,000 kobo (₦2,000)
  - Total: 7,500 kobo (₦75)

NAPPS Share:
  - Fixed: 0 kobo
  - Percentage: 10% of 500,000 = 50,000 kobo
  - Total: 50,000 kobo (₦500)

Total Fees: 67,500 kobo (₦675)
Total Amount: 567,500 kobo (₦5,675)
```

## Best Practices

1. **Always validate fee configurations** before activation
2. **Test calculations** with different amounts
3. **Set reasonable caps** on processing fees
4. **Use descriptive names** for fees
5. **Document custom fees** in metadata
6. **Audit changes** by tracking lastModifiedBy
7. **Set validity periods** for time-limited fees
8. **Use bulk updates** for efficiency

## Security

- All admin operations require JWT authentication
- Only users with `ADMIN` role can create/update/delete fees
- Public endpoints are read-only
- Fee calculations are transparent and auditable
- Split configurations are validated

## Monitoring

Track fee performance with statistics endpoint:
- Total configurations
- Active vs inactive fees
- Recurring fee counts
- Average fee amounts
- Configuration trends

## Frontend Integration

```typescript
// Fetch active fees for payment form
const activeFees = await fetch('/fees/configuration/active');
const fees = await activeFees.json();

// Calculate total before payment
const calculation = await fetch('/fees/configuration/calculate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    feeCode: 'membership_fee',
    customAmount: 5000
  })
});

const { breakdown, totalAmount } = await calculation.json();
// Display breakdown to user before payment
```

## Troubleshooting

**Issue**: Fee configuration not applied to payment
- Check if fee is active
- Verify fee code matches payment type
- Check validity dates

**Issue**: Split configuration not working
- Verify Paystack subaccount codes
- Ensure percentages add up correctly
- Check subaccount is active in Paystack

**Issue**: Processing fee too high
- Adjust processingFeeCap value
- Review processingFeePercentage

## Support

For issues or questions:
- Backend: Check logs for fee calculation details
- API: Use /fees/configuration/calculate to test
- Database: Query FeeConfiguration collection
