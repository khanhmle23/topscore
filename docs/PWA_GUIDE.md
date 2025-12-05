# PWA Installation Guide

TopScore Golf is now a Progressive Web App (PWA)! This means users can install it on their mobile devices and use it like a native app.

## Features

✅ **Install on Any Device** - Works on iOS, Android, and desktop  
✅ **Offline Support** - Basic functionality works without internet  
✅ **Home Screen Icon** - Appears like a native app  
✅ **Fast Loading** - Cached assets for quick startup  
✅ **No App Store Required** - Users install directly from browser  

## How Users Install

### iOS (Safari)

1. Open `https://your-domain.com` in Safari
2. Tap the Share button (square with arrow)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add" in the top right corner
5. The TopScore Golf icon will appear on the home screen

### Android (Chrome)

1. Open `https://your-domain.com` in Chrome
2. Tap the menu (three dots)
3. Tap "Install app" or "Add to Home screen"
4. Confirm by tapping "Install"
5. The app will appear in the app drawer

### Desktop (Chrome/Edge)

1. Visit `https://your-domain.com`
2. Look for the install icon in the address bar (➕)
3. Click it and select "Install"
4. The app opens in its own window

## Automatic Install Prompt

The app automatically shows an install prompt to eligible users. The prompt appears:
- On desktop and Android devices
- After the user has visited twice
- When not already installed
- Users can click "Install" or dismiss with "Not Now"

## Technical Details

- **Service Worker**: Handles caching and offline functionality
- **Manifest**: Defines app metadata, icons, and behavior
- **Icons**: 192x192 and 512x512 PNG icons
- **Display Mode**: Standalone (full-screen, no browser UI)
- **Theme Color**: Blue (#2563eb)

## Testing PWA Features

1. **Test Install Prompt**: Clear browser data and revisit the site
2. **Test Offline**: Install the app, then disconnect internet
3. **Test Icons**: Check home screen icon after installation
4. **Test Service Worker**: Open DevTools → Application → Service Workers

## Deployment

When deploying to Vercel, Netlify, or other platforms:

1. Ensure all files in `/public` are deployed
2. Service worker (`sw.js`) must be at root level
3. Manifest (`manifest.json`) must be accessible
4. HTTPS is required for PWA features

## Lighthouse PWA Audit

Run a Lighthouse audit to check PWA compliance:

```bash
# In Chrome DevTools
1. Open DevTools (F12)
2. Go to Lighthouse tab
3. Select "Progressive Web App"
4. Click "Generate report"
```

Target score: 90+ for full PWA compliance

## Troubleshooting

**Install prompt doesn't appear:**
- Clear browser cache and revisit
- Check that HTTPS is enabled
- Verify manifest.json is loading
- Check service worker is registered

**Icons not showing:**
- Verify PNG files exist in `/public`
- Check manifest.json icon paths
- Clear browser cache

**Offline mode not working:**
- Check service worker registration in DevTools
- Verify cache strategy in `sw.js`
- Test with airplane mode

## Future Enhancements

- Push notifications for scorecard reminders
- Background sync for offline uploads
- Camera API integration for better photo capture
- Offline scorecard storage
