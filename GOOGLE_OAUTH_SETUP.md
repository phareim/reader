# Google OAuth Setup Guide

To enable Google Login, you need to create OAuth credentials in the Google Cloud Console.

**Note:** You do NOT need to enable any special APIs or use the deprecated Google+ API. Modern OAuth only needs the consent screen and credentials.

## Option 1: Using Google Cloud Console (Recommended)

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Name it something like "Vibe Reader" or "RSS Reader"

### Step 2: Configure OAuth Consent Screen

1. Go to **APIs & Services** > **OAuth consent screen**
2. Select **External** user type (unless you have a Google Workspace)
3. Click **Create**
4. Fill in the required information:
   - **App name**: Vibe Reader
   - **User support email**: Your email
   - **Developer contact email**: Your email
5. Click **Save and Continue**
6. On the **Scopes** page, click **Save and Continue** (default scopes are fine)
7. On the **Test users** page (if in testing mode):
   - Click **Add Users**
   - Add your email address
   - Click **Save and Continue**
8. Click **Back to Dashboard**

### Step 3: Create OAuth Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Select **Application type**: Web application
4. **Name**: Vibe Reader Web Client
5. **Authorized JavaScript origins**:
   - Add: `http://localhost:3000`
   - Add: `https://yourdomain.com` (when deploying to production)
6. **Authorized redirect URIs**:
   - Add: `http://localhost:3000/api/auth/callback/google`
   - Add: `https://yourdomain.com/api/auth/callback/google` (when deploying)
7. Click **Create**

### Step 4: Copy Credentials to .env

1. After creating, you'll see a modal with:
   - **Client ID**: Something like `123456789-abc...apps.googleusercontent.com`
   - **Client Secret**: Something like `GOCSPX-...`
2. Copy these values
3. Open your `.env` file
4. Replace the placeholder values:
   ```
   GOOGLE_CLIENT_ID="your-actual-client-id-here"
   GOOGLE_CLIENT_SECRET="your-actual-client-secret-here"
   ```

### Step 5: Generate Auth Secret

For the `AUTH_SECRET`, generate a random string:

```bash
# On Mac/Linux
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Replace the `AUTH_SECRET` in `.env` with the generated value.

### Step 6: Start the Server

```bash
npm run dev
```

Now visit `http://localhost:3000` and you should be redirected to the login page where you can sign in with Google!

## Troubleshooting

### "redirect_uri_mismatch" Error

- Make sure the redirect URI in Google Console exactly matches: `http://localhost:3000/api/auth/callback/google`
- Check for trailing slashes
- Ensure the port number matches

### "Access blocked: This app's request is invalid"

- Check that your test user (email) is added to the OAuth consent screen
- Make sure you've completed the OAuth consent screen configuration

### "Error 401: invalid_client"

- Double-check your Client ID and Client Secret in `.env`
- Make sure there are no extra spaces or quotes

---

## Option 2: Using Firebase (If You Prefer)

If you're already using Firebase, you can use Firebase Authentication which is simpler:

### Step 1: Firebase Console Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your existing project or create a new one
3. Go to **Authentication** > **Sign-in method**
4. Enable **Google** provider
5. You'll see the **Web SDK configuration** with credentials

### Step 2: Get OAuth Credentials

Firebase automatically creates OAuth credentials, but NextAuth needs the raw Google credentials:

1. Click on **Google** in the sign-in methods
2. Click **Web SDK configuration** at the bottom
3. Note your **Web client ID** (this is your `GOOGLE_CLIENT_ID`)
4. For the secret, you need to:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Select the same project (Firebase creates it automatically)
   - Go to **APIs & Services** > **Credentials**
   - Find the **Web client (auto created by Google Service)**
   - Click on it to see the **Client Secret**

### Step 3: Add Redirect URI

In Google Cloud Console (same project):
1. Edit the auto-created Web client
2. Add to **Authorized redirect URIs**:
   - `http://localhost:3000/api/auth/callback/google`
   - Your production URL when deploying

### Step 4: Add to .env

Same as Option 1 - add the Client ID and Secret to your `.env` file.

**Note:** Using Firebase this way only gets you the OAuth credentials. You're not using Firebase Auth itself, just leveraging the OAuth setup. The actual authentication is handled by NextAuth + your database.

---

## Production Deployment

When deploying to production:

1. Add your production URL to **Authorized JavaScript origins**
2. Add your production callback URL to **Authorized redirect URIs**
3. Update `AUTH_ORIGIN` in `.env` to your production URL
4. Publish your OAuth consent screen (move from Testing to Production)
5. Generate a new, secure `AUTH_SECRET`
