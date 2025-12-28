# Cloudinary Setup Guide

## Environment Variables

Add these **exact** variable names to your `.env` file or Render environment variables:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name_here
CLOUDINARY_API_KEY=your_api_key_here
CLOUDINARY_API_SECRET=your_api_secret_here
```

## How to Get Your Cloudinary Credentials

1. **Sign up for Cloudinary** (if you haven't already):
   - Go to https://cloudinary.com
   - Click "Sign Up" (free tier available)

2. **Access Your Dashboard**:
   - Log in to your Cloudinary account
   - You'll be taken to the Dashboard

3. **Find Your Credentials**:
   - Look at the top of the Dashboard
   - You'll see your **Cloud Name** displayed
   - Click on the gear icon (⚙️) or go to **Settings** → **Access Keys**
   - You'll see:
     - **Cloud Name** (e.g., `dxyz123abc`)
     - **API Key** (e.g., `123456789012345`)
     - **API Secret** (e.g., `abcdefghijklmnopqrstuvwxyz123456`)

4. **Copy Your Credentials**:
   - Copy each value exactly as shown
   - Paste them into your `.env` file or Render environment variables

## Example `.env` File

```env
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=dxyz123abc
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuvwxyz123456

# Other environment variables...
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
PORT=5000
```

## For Render.com

1. Go to your Render dashboard
2. Select your service (lost-items-backend)
3. Go to **Environment** tab
4. Click **Add Environment Variable**
5. Add each variable:
   - Key: `CLOUDINARY_CLOUD_NAME`, Value: `your_cloud_name`
   - Key: `CLOUDINARY_API_KEY`, Value: `your_api_key`
   - Key: `CLOUDINARY_API_SECRET`, Value: `your_api_secret`
6. Save and redeploy

## Important Notes

- ⚠️ **Never commit your `.env` file to Git** - it contains sensitive credentials
- ✅ The variable names are **case-sensitive** - use exactly as shown:
  - `CLOUDINARY_CLOUD_NAME` (all caps, underscores)
  - `CLOUDINARY_API_KEY` (all caps, underscores)
  - `CLOUDINARY_API_SECRET` (all caps, underscores)
- 🔒 Keep your API Secret secure - don't share it publicly
- 📸 Images will be uploaded to Cloudinary folders:
  - Found items: `lost-found/found-items/`
  - Lost items: `lost-found/lost-items/`

## Testing

After setting up, restart your server. You should see:
```
✅ Cloudinary configured
```

If you see a warning instead, double-check your environment variable names and values.

