# Security Controls

## Overview
This document outlines the security measures implemented in TopScore Golf PWA.

## ✅ Implemented Security Controls

### 1. **Rate Limiting**
- **What**: Limits API requests to 50 per 15-minute window per IP
- **Why**: Prevents abuse and protects against DoS attacks
- **Location**: `middleware.ts`
- **Headers**: Returns `X-RateLimit-Limit` and `X-RateLimit-Remaining`

### 2. **File Upload Validation**
- **MIME Type Checking**: Only allows image files (JPG, PNG, WebP, HEIC)
- **File Size Limits**: 
  - Minimum: 100 bytes (prevents empty files)
  - Maximum: 10MB (prevents resource exhaustion)
- **Filename Sanitization**: Removes path traversal attempts (`../`, `./`)
- **Location**: `lib/fileValidator.ts`

### 3. **HEIC/HEIF Support**
- **What**: Converts iPhone HEIC images to JPEG automatically
- **Why**: Native iOS format isn't widely supported for processing
- **Security**: Validates HEIC files before conversion
- **Location**: `lib/heicConverter.ts`

### 4. **Security Headers**
Applied to all responses via middleware:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### 5. **HTTPS Enforcement**
- **What**: PWA requires HTTPS to function
- **Why**: Prevents man-in-the-middle attacks
- **Provider**: Vercel automatically provides HTTPS

### 6. **Service Worker Security**
- **Origin Checking**: Only caches same-origin requests
- **Cache Isolation**: Separate cache namespaces per version
- **Location**: `public/sw.js`

### 7. **Input Sanitization**
- Filenames sanitized before logging
- No user input directly executed
- Buffer validation before processing

## ⚠️ Known Limitations

### 1. **No User Authentication**
- **Risk**: Anyone can upload images and use API
- **Mitigation**: Rate limiting prevents abuse
- **Future**: Consider adding API keys for production use

### 2. **API Keys in Backend Only**
- **Current**: AWS and OpenAI keys stored in environment variables
- **Good**: Not exposed to client
- **Risk**: Still accessible via API if someone reverse engineers
- **Future**: Consider API gateway with authentication

### 3. **In-Memory Rate Limiting**
- **Risk**: Resets on server restart, can be bypassed with IP rotation
- **Mitigation**: Acceptable for small-scale use
- **Future**: Use Redis for persistent rate limiting in production

### 4. **No Request Signing**
- **Risk**: Anyone can call the API endpoints
- **Future**: Implement HMAC request signing for production

### 5. **No Content Security Policy (CSP)**
- **Risk**: XSS attacks possible if user input ever rendered
- **Current**: No user input rendered directly (low risk)
- **Future**: Add CSP headers for defense-in-depth

## 🔒 Best Practices for Deployment

### Environment Variables
Never commit these to Git:
```bash
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
OPENAI_API_KEY=your_key
```

### Vercel Security Settings
1. Enable "Automatically expose System Environment Variables": **NO**
2. Use separate keys for preview vs production
3. Enable "Branch Deployments" protection

### Monitoring
- Monitor Vercel Analytics for unusual traffic patterns
- Set up alerts for 429 (rate limit) responses
- Review error logs regularly for attack patterns

## 🛡️ Security Checklist

Before deploying to production:

- [ ] Environment variables configured in Vercel
- [ ] HTTPS enabled (automatic with Vercel)
- [ ] Rate limiting tested
- [ ] File upload validation tested with various file types
- [ ] HEIC conversion tested with iPhone photos
- [ ] Error messages don't leak sensitive information
- [ ] No API keys in client-side code
- [ ] Security headers verified (use securityheaders.com)
- [ ] PWA manifest validated
- [ ] Service worker cache properly namespaced

## 📊 Testing Security

### Test Rate Limiting
```bash
# Send 51 requests quickly (should get 429 on 51st)
for i in {1..51}; do curl -X POST https://your-app.vercel.app/api/scorecards; done
```

### Test File Upload Validation
1. Try uploading a .txt file (should fail)
2. Try uploading 11MB image (should fail)
3. Try filename with `../etc/passwd` (should sanitize)
4. Upload iPhone HEIC photo (should convert automatically)

### Test Security Headers
```bash
curl -I https://your-app.vercel.app
# Check for X-Frame-Options, X-Content-Type-Options, etc.
```

## 🚨 Incident Response

If you detect suspicious activity:

1. **Immediate**: Lower rate limits in `middleware.ts`
2. **Review**: Check Vercel logs for patterns
3. **Block**: Add IP blocking if needed (Vercel Firewall)
4. **Update**: Rotate API keys if compromised
5. **Document**: Record the incident and response

## 📞 Reporting Security Issues

If you discover a security vulnerability:
- **Do NOT** open a public GitHub issue
- Email: [your-security-email@example.com]
- Include: detailed description, steps to reproduce, potential impact

## 🔄 Security Update Policy

- Security patches: Applied immediately
- Dependency updates: Monthly review
- Vulnerability scans: Automated via `npm audit`
