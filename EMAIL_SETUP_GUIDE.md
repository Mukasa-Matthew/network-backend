# Email Setup Guide

## Gmail Configuration

To use Gmail for sending emails, you need to:

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password** (not your regular password)

### Steps:

1. Go to your Google Account settings: https://myaccount.google.com/
2. Navigate to Security → 2-Step Verification
3. Scroll down to "App passwords"
4. Generate a new app password for "Mail"
5. Use this 16-character app password in your `.env` file

### Environment Variables

Add these to your `.env` file:

```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-16-character-app-password
ADMIN_EMAIL=your-email@gmail.com
```

### Important Notes:

- **DO NOT** use your regular Gmail password
- **DO** use the 16-character app password
- Make sure 2-Factor Authentication is enabled
- The app password will look like: `abcd efgh ijkl mnop`

### Troubleshooting:

If you get connection errors:
1. Verify your app password is correct
2. Make sure 2-Factor Authentication is enabled
3. Try generating a new app password
4. Check that your Gmail account allows "less secure app access" (though app passwords are preferred)

