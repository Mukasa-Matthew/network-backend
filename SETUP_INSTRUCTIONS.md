# Environment Configuration

To fix the email notification issues, you need to create a `.env` file in the `backend` directory.

## Create `.env` file

Create a file named `.env` in the `backend` directory with the following content:

```env
# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password-here
ADMIN_EMAIL=admin@yourdomain.com

# JWT Secret
JWT_SECRET=your-secret-key-here

# Server Configuration
PORT=5000
NODE_ENV=development
```

## Email Setup Instructions

1. **Gmail Setup**:
   - Enable 2-Factor Authentication on your Gmail account
   - Go to Google Account settings → Security → 2-Step Verification → App passwords
   - Generate a password for "Mail"
   - Use that password as `EMAIL_PASSWORD`

2. **Replace the values**:
   - `your-email@gmail.com` → Your actual Gmail address
   - `your-app-password-here` → The app password you generated
   - `admin@yourdomain.com` → The email where you want to receive notifications
   - `your-secret-key-here` → A random string for JWT security

## After creating the .env file

1. Restart the backend server
2. Try the "Test Email" button again
3. The hotspot monitoring should work without crashes

## What was fixed

- ✅ Fixed socket destroy errors that were crashing the server
- ✅ Added proper error handling for MikroTik connections
- ✅ Added timeout protection for hotspot scanning
- ✅ Added consecutive error tracking to prevent infinite error loops
- ✅ Fixed email parameter order issues
- ✅ Added graceful shutdown handling
