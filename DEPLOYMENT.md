# Deployment Guide

## GitHub Deployment

### 1. Create GitHub Repository
1. Go to [GitHub.com](https://github.com) and sign in
2. Click the "+" icon → "New repository"
3. Name: `web-tracking-dashboard`
4. Make it **Private** (recommended for sensitive data)
5. Don't initialize with README, .gitignore, or license
6. Click "Create repository"

### 2. Push Code to GitHub
```bash
# Add GitHub as remote origin
git remote add origin https://github.com/YOUR_USERNAME/web-tracking-dashboard.git

# Add all files
git add .

# Commit changes
git commit -m "Initial commit: Web tracking dashboard"

# Push to GitHub
git push -u origin main
```

## Environment Variables

Create a `.env.local` file in the root directory with:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: Production URL
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## Deployment Platforms

### GitHub Pages (Static Export)
1. Push code to GitHub repository
2. Add environment variables as GitHub Secrets:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Enable GitHub Pages in repository settings
4. Set source to "GitHub Actions"
5. Deploy automatically via GitHub Actions

### Vercel (Recommended for Next.js)
1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically

### Netlify
1. Connect GitHub repository
2. Build command: `npm run build`
3. Publish directory: `out` (after `next export`)
4. Add environment variables

### Railway
1. Connect GitHub repository
2. Add environment variables
3. Deploy automatically

## Database Setup
1. Run `database-setup.sql` in Supabase SQL Editor
2. Create admin user in Supabase
3. Add test data if needed

## Security Notes
- Keep Supabase credentials secure
- Use environment variables for sensitive data
- Enable Row Level Security (RLS) in Supabase
- Consider using GitHub Secrets for CI/CD
