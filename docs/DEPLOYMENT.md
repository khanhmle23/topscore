# Deploying TopScore Golf PWA to Vercel

Follow these steps to deploy your PWA to Vercel (free hosting with automatic HTTPS).

## Prerequisites

- GitHub account with your repository
- Vercel account (sign up at vercel.com with GitHub)

## Step 1: Prepare Environment Variables

Create a `.env.production` file with your API keys:

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
OPENAI_API_KEY=your_openai_key
```

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: ./
   - **Build Command**: `npm run build`
   - **Output Directory**: .next
5. Add Environment Variables (from Step 1)
6. Click "Deploy"

### Option B: Deploy via CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Follow prompts:
# - Link to existing project or create new
# - Set environment variables when prompted

# Deploy to production
vercel --prod
```

## Step 3: Configure Custom Domain (Optional)

1. In Vercel Dashboard, go to your project
2. Click "Settings" → "Domains"
3. Add your custom domain (e.g., `topscoregolf.com`)
4. Follow DNS configuration instructions
5. Wait for SSL certificate (automatic, takes ~1 minute)

## Step 4: Test PWA Installation

1. Visit your deployed URL (e.g., `your-app.vercel.app`)
2. Test on mobile device:
   - **iOS**: Safari → Share → Add to Home Screen
   - **Android**: Chrome → Menu → Install app
3. Test install prompt on desktop (Chrome/Edge)
4. Verify service worker in DevTools → Application

## Step 5: Verify PWA Compliance

Run Lighthouse audit:

```bash
# Using Chrome DevTools
1. Open your deployed site
2. Press F12 → Lighthouse tab
3. Select "Progressive Web App"
4. Click "Generate report"
5. Ensure score is 90+
```

## Environment Variables on Vercel

Add these in Vercel Dashboard → Settings → Environment Variables:

| Variable | Value | Environment |
|----------|-------|-------------|
| `AWS_REGION` | us-east-1 | Production |
| `AWS_ACCESS_KEY_ID` | your-key | Production |
| `AWS_SECRET_ACCESS_KEY` | your-secret | Production |
| `OPENAI_API_KEY` | sk-... | Production |

## Automatic Deployments

Vercel automatically deploys:
- **Main branch** → Production
- **Other branches** → Preview deployments
- **Pull requests** → Preview URLs

Every push triggers a new deployment.

## PWA Caching Strategy

The service worker uses:
- **Static assets**: Cache-first (fast loading)
- **API calls**: Network-first (fresh data)
- **Images**: Cache-first with network fallback

## Monitoring

Monitor your PWA:

1. **Vercel Analytics**: Project → Analytics tab
2. **Web Vitals**: Core Web Vitals metrics
3. **Service Worker**: DevTools → Application → Service Workers
4. **Console Logs**: Check for `[PWA]` prefixed logs

## Troubleshooting

**Service worker not registering:**
```bash
# Check in DevTools Console
# Should see: [PWA] Service Worker registered
```

**Install prompt not showing:**
- HTTPS is required (Vercel provides automatically)
- User must visit site 2+ times
- Site must meet PWA criteria

**Icons not loading:**
```bash
# Verify files exist:
https://your-app.vercel.app/icon-192.png
https://your-app.vercel.app/manifest.json
```

## Performance Optimization

For best PWA performance:

1. **Enable Vercel Edge Functions** (automatic)
2. **Use Image Optimization** (Next.js handles this)
3. **Enable Caching Headers** (configured in `sw.js`)
4. **Compress Assets** (Vercel does automatically)

## Cost

Vercel Free Tier includes:
- ✅ Unlimited deployments
- ✅ Automatic HTTPS
- ✅ 100GB bandwidth/month
- ✅ Serverless functions
- ✅ Preview deployments

Perfect for PWA hosting!

## Support

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js PWA Guide](https://nextjs.org/docs/basic-features/progressive-web-apps)
- [Web.dev PWA Guide](https://web.dev/progressive-web-apps/)
