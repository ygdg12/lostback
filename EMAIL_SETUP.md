# Email Configuration Guide

To enable password reset emails, you need to configure email settings in your `.env` file.

## Option 1: Using Gmail (Recommended for Testing)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Enter "FoundCloud Backend" and click Generate
   - Copy the 16-character password

3. **Add to your `.env` file**:

```env
EMAIL_SERVICE=gmail
EMAIL_USER=yourgmail@gmail.com
EMAIL_PASS=your_16_char_app_password
EMAIL_FROM="FoundCloud Support <yourgmail@gmail.com>"
```

## Option 2: Using Outlook/Hotmail

```env
EMAIL_SERVICE=outlook
EMAIL_USER=youroutlook@outlook.com
EMAIL_PASS=your_password
EMAIL_FROM="FoundCloud Support <youroutlook@outlook.com>"
```

## Option 3: Custom SMTP Server

```env
EMAIL_HOST=smtp.yourprovider.com
EMAIL_PORT=587
EMAIL_USER=your_email@domain.com
EMAIL_PASS=your_password
EMAIL_FROM="FoundCloud Support <your_email@domain.com>"
```

## Common SMTP Ports:
- **587** - TLS (most common, recommended)
- **465** - SSL
- **25** - Plain (often blocked)

## Verification

After setting up your `.env` file, restart your server. You should see:

```
✅ Email transporter configured with service: gmail
✅ Email transporter verified and ready to send emails
```

If you see warnings instead:
```
⚠️ EMAIL_USER or EMAIL_PASS not set. Email will not be sent.
```

Then check your `.env` file and make sure the variables are set correctly.

## Testing

When you generate a password reset token via the admin panel:
- ✅ If email is configured: Email will be sent automatically
- ❌ If email is not configured: Token will be returned in the API response so admin can share manually
