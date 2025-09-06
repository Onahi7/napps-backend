# Admin User Setup Guide

This guide explains how to create admin users for both the Connect Hub and Portal applications with properly hashed passwords.

## 🔐 Admin Credentials

**Password:** `admin@2025`
**Hashed Password:** `$2b$12$kFQzgKnxulVcNhDjFGMEF.wb/PMcIt54a1/zub0OAdJHts1/c6.NO`

## 👥 Admin Users Created

### 1. Connect Hub Admin
- **Email:** `admin@connecthub.com`
- **Password:** `admin@2025`
- **Role:** `admin`
- **App Access:** `connect_hub`
- **Purpose:** Manages public website content (hero images, team members)

### 2. Portal Admin
- **Email:** `admin@portal.com`
- **Password:** `admin@2025`
- **Role:** `admin`
- **App Access:** `portal`
- **Purpose:** Manages portal features (schools, proprietors, payments)

### 3. Super Admin
- **Email:** `superadmin@napps.com`
- **Password:** `admin@2025`
- **Role:** `super_admin`
- **App Access:** `connect_hub, portal`
- **Purpose:** Full access to both applications

## 🚀 Setup Methods

### Method 1: Node.js Script (Recommended)

1. Navigate to the backend directory:
   ```bash
   cd napps-backend
   ```

2. Install dependencies (if not already installed):
   ```bash
   npm install
   ```

3. Run the admin user creation script:
   ```bash
   node scripts/create-admin-users.js
   ```

This script will:
- Connect to your MongoDB database
- Hash the password using bcrypt
- Create or update admin users
- Verify the users can login
- Display login credentials

### Method 2: MongoDB Direct Script

1. Open MongoDB Compass or connect to your MongoDB instance
2. Select the `napps_nasarawa_prod` database
3. Run the script from `scripts/mongo-admin-users.js`

Or using mongo shell:
```bash
mongo "mongodb+srv://your-connection-string/napps_nasarawa_prod"
load('scripts/mongo-admin-users.js')
```

### Method 3: Manual Password Hash Generation

If you need to generate a new password hash:

```bash
node scripts/hash-password.js
```

## 🔧 Environment Configuration

Make sure your `.env.production` file contains the correct MongoDB URI:

```env
MONGODB_URI=mongodb+srv://mmmnigeriaschool12_db_user:Iamhardy_7*@cluster0.abdi7yt.mongodb.net/napps_nasarawa_prod?retryWrites=true&w=majority&appName=Cluster0
```

## 🔍 Verification

After running the script, you should see output like:

```
✅ Created admin user: admin@connecthub.com
✅ Created admin user: admin@portal.com
✅ Created admin user: superadmin@napps.com
📊 Created/Updated 3/3 admin users
✅ Password verification successful for admin@connecthub.com
✅ Password verification successful for admin@portal.com
✅ Password verification successful for superadmin@napps.com
```

## 🌐 Login URLs

### Connect Hub Admin
- **URL:** `https://your-connect-hub-domain.com/admin`
- **Email:** `admin@connecthub.com`
- **Password:** `admin@2025`

### Portal Admin
- **URL:** `https://your-portal-domain.com/admin`
- **Email:** `admin@portal.com`
- **Password:** `admin@2025`

## 🛡️ Security Notes

1. **Change Default Password:** After first login, change the default password
2. **Secure Storage:** The password is hashed using bcrypt with 12 salt rounds
3. **App Access Control:** Each admin is restricted to their designated apps
4. **Environment Variables:** Keep your MongoDB URI secure and never commit to version control

## 📝 Database Schema

The admin users are stored in the `users` collection with the following structure:

```javascript
{
  email: String (unique),
  firstName: String,
  lastName: String,
  password: String (hashed),
  role: String ('admin' | 'super_admin'),
  appAccess: [String] (['connect_hub'] | ['portal'] | ['connect_hub', 'portal']),
  isActive: Boolean (true),
  isEmailVerified: Boolean (true),
  createdAt: Date,
  updatedAt: Date
}
```

## 🆘 Troubleshooting

### Script Fails to Connect
- Check your MongoDB URI in `.env.production`
- Ensure your IP is whitelisted in MongoDB Atlas
- Verify network connectivity

### Users Not Created
- Check database permissions
- Ensure the `users` collection exists
- Verify the script completed without errors

### Login Issues
- Verify the user was created in the database
- Check the password hash matches
- Ensure the frontend is pointing to the correct API endpoint

## 🔄 Re-running Scripts

The scripts are designed to be idempotent - you can run them multiple times safely. They will:
- Create new users if they don't exist
- Update existing users with new data
- Maintain data integrity

## 📞 Support

If you encounter issues:
1. Check the script output for error messages
2. Verify your database connection
3. Ensure all dependencies are installed
4. Check the MongoDB logs for connection issues