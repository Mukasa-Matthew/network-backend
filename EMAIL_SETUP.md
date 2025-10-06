# Email Notification Setup Guide

This guide will help you set up email notifications for user connection events in your MikroTik monitoring system.

## Features

The email notification system will send you beautiful HTML emails when:

- 🔗 **New User Connected**: When a new user logs into your network
- 🔌 **User Disconnected**: When a user disconnects from your network
- 🔄 **User Reconnected**: When a user reconnects after being disconnected
- 🆕 **New User Login**: When a completely new user (never seen before) connects
- ⏰ **User Time Expired**: When a user's allocated time expires and they're kicked off

## Email Configuration

### 1. Gmail Setup (Recommended)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a password for "Mail"
   - Copy the generated password

3. **Add to your `.env` file**:
```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password-here
ADMIN_EMAIL=admin@yourdomain.com
```

### 2. Other Email Providers

You can modify the email service configuration in `backend/services/email-service.js`:

```javascript
this.transporter = nodemailer.createTransporter({
    service: 'outlook', // or 'yahoo', 'hotmail', etc.
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});
```

Or use custom SMTP settings:

```javascript
this.transporter = nodemailer.createTransporter({
    host: 'smtp.yourprovider.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});
```

## Installation

1. **Install Dependencies**:
```bash
npm install nodemailer
```

2. **Configure Environment Variables**:
Create a `.env` file in the backend directory with:
```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
ADMIN_EMAIL=admin@yourdomain.com
```

3. **Start the Server**:
```bash
npm start
```

## API Endpoints

### Start User Monitoring
```http
POST /api/user-monitoring/start
Authorization: Bearer <your-jwt-token>
```

### Stop User Monitoring
```http
POST /api/user-monitoring/stop
Authorization: Bearer <your-jwt-token>
```

### Get Monitoring Status
```http
GET /api/user-monitoring/status
Authorization: Bearer <your-jwt-token>
```

### Get User Statistics
```http
GET /api/user-monitoring/statistics
Authorization: Bearer <your-jwt-token>
```

### Test Email Notification
```http
POST /api/user-monitoring/test-email
Authorization: Bearer <your-jwt-token>
```

### Cleanup Old Data
```http
POST /api/user-monitoring/cleanup
Authorization: Bearer <your-jwt-token>
```

## Email Templates

The system includes beautiful HTML email templates for each notification type:

### 1. User Connected Email
- **Color**: Blue gradient
- **Icon**: 🔗
- **Information**: Host name, MAC address, IP address, connection type, signal strength, session details

### 2. User Disconnected Email
- **Color**: Red gradient
- **Icon**: 🔌
- **Information**: User details, session summary, data usage statistics

### 3. User Reconnected Email
- **Color**: Light blue gradient
- **Icon**: 🔄
- **Information**: User details, reconnection timing, remaining time

### 4. New User Login Email
- **Color**: Purple gradient
- **Icon**: 🆕
- **Information**: New user alert, user details, login information

### 5. User Time Expired Email
- **Color**: Pink gradient
- **Icon**: ⏰
- **Information**: Time expiration alert, session summary, data usage

## Monitoring Behavior

### Automatic Monitoring
- **Interval**: Checks every 30 seconds
- **Tracking**: Monitors all active hotspot users
- **Detection**: Automatically detects new users, disconnections, and reconnections

### User Tracking
- **Known Users**: Maintains a list of all users who have ever connected
- **Active Sessions**: Tracks currently connected users
- **Disconnected Users**: Keeps track of recently disconnected users for reconnection detection

### Time Expiration Detection
The system detects time expiration by checking:
- Data usage limits (bytes in/out)
- Total data limits
- Session time limits (if configured)

## Customization

### Modify Email Templates
Edit the email creation methods in `backend/services/email-service.js`:
- `createUserConnectedEmail()`
- `createUserDisconnectedEmail()`
- `createUserReconnectedEmail()`
- `createNewUserLoginEmail()`
- `createUserTimeExpiredEmail()`

### Change Monitoring Interval
Modify the interval in `backend/services/user-monitor.js`:
```javascript
this.monitoringInterval = setInterval(async () => {
    // ... monitoring logic
}, 30000); // Change from 30000ms (30 seconds) to your preferred interval
```

### Add Custom Notifications
Extend the `UserMonitor` class to add custom notification logic:
```javascript
async handleCustomEvent(user) {
    // Your custom logic here
    await this.emailService.sendEmail(html, subject, recipient);
}
```

## Troubleshooting

### Email Not Sending
1. **Check Gmail Settings**:
   - Ensure 2FA is enabled
   - Verify app password is correct
   - Check if "Less secure app access" is disabled

2. **Check Environment Variables**:
   - Verify `EMAIL_USER` and `EMAIL_PASSWORD` are set
   - Ensure `ADMIN_EMAIL` is set to receive notifications

3. **Test Email Function**:
   - Use the `/api/user-monitoring/test-email` endpoint
   - Check server logs for error messages

### Monitoring Not Working
1. **Check Authentication**:
   - Ensure you're logged in with a valid JWT token
   - Verify the MikroTik connection is active

2. **Check Server Logs**:
   - Look for "User monitoring started" message
   - Check for any error messages in the console

3. **Verify API Endpoints**:
   - Test the `/api/user-monitoring/status` endpoint
   - Ensure the monitoring is active

## Security Considerations

1. **App Passwords**: Use app passwords instead of your main Gmail password
2. **Environment Variables**: Never commit `.env` files to version control
3. **Rate Limiting**: The system includes rate limiting to prevent abuse
4. **JWT Tokens**: All API endpoints require valid JWT authentication

## Support

If you encounter issues:
1. Check the server logs for error messages
2. Verify your email configuration
3. Test with the provided test endpoints
4. Ensure your MikroTik router is accessible and configured correctly







