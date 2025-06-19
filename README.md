# Contact Lens Pricing Tool - Secure Implementation

This application has been updated to follow security best practices by using a Vercel serverless function to handle Google Sheets API calls.

## Security Improvements Made

✅ **API Key Hidden**: Google API key is no longer exposed in frontend code  
✅ **Serverless Function**: Google Sheets API calls now go through `/api/sheets.js`  
✅ **Environment Variables**: Sensitive data stored in environment variables  
✅ **Secure Frontend**: Frontend only calls your own API endpoint  

## Setup Instructions

### 1. Get Your Google API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google Sheets API
4. Create credentials (API Key)
5. Copy your API key

### 2. Local Development Setup

Create a `.env` file in your project root:

```env
GOOGLE_API_KEY=your_actual_google_api_key_here
SHEET_ID=1NpL7Ip_oaj8FEi_zTTl-7t9hdWSGWrtHyfRYUvLyons
```

### 3. Vercel Deployment Setup

1. Deploy to Vercel using their CLI or GitHub integration
2. In your Vercel dashboard, go to Settings → Environment Variables
3. Add these environment variables:
   - `GOOGLE_API_KEY`: Your Google API key
   - `SHEET_ID`: Your Google Sheet ID

### 4. Google Sheet Permissions

Make sure your Google Sheet is either:
- Public (anyone with link can view)
- Shared with appropriate permissions for your API key

## File Structure

```
├── api/
│   └── sheets.js          # Serverless function (handles API calls securely)
├── index.html             # Frontend (no longer contains API keys)
├── sheets.js              # Frontend logic (calls serverless function)
├── style.css              # Styles
├── vercel.json            # Vercel configuration
└── README.md              # This file
```

## How It Works Now

1. **Frontend** → calls `/api/sheets?sheetName=Prices`
2. **Serverless Function** → fetches from Google Sheets using API key
3. **Response** → returns data to frontend securely

## Testing

1. Set up your environment variables
2. Run locally or deploy to Vercel
3. The application should work exactly the same as before, but now securely

## Troubleshooting

- **"Server configuration error"**: Check your environment variables are set correctly
- **"Failed to fetch data"**: Verify your Google API key and sheet permissions
- **CORS errors**: The serverless function includes CORS headers for local development

## Security Benefits

- ✅ API keys never exposed to users
- ✅ All API calls go through your secure serverless function
- ✅ Environment variables keep secrets safe
- ✅ Frontend code is clean and secure 