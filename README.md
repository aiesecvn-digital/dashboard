# Web Tracking Dashboard

A modern web tracking dashboard built with Next.js, Supabase, and Tailwind CSS, inspired by Looker Studio and AIESEC Expa platform.

## Features

- 🔐 **Authentication System**: Login with Supabase Auth (no public signup)
- 📊 **Dashboard**: Modern analytics dashboard with LC performance tracking
- 👥 **User Management**: Admin-only user creation and management
- 📈 **Analytics**: Manual allocation for form submissions
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile
- 🎨 **Modern UI**: Beautiful orange gradient design with glassmorphism
- 🔒 **Protected Routes**: Role-based access control
- 📊 **Real-time Data**: Live statistics from form submissions

## Tech Stack

- **Frontend**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: Supabase Auth
- **Database**: Supabase PostgreSQL
- **Icons**: Lucide React
- **Charts**: Custom bar charts and data visualization

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd web-tracking-dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase**
   - Create a new project at [supabase.com](https://supabase.com)
   - Go to Settings > API
   - Copy your Project URL and anon public key

4. **Configure environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

5. **Set up the database**
   Run the SQL script in `database-setup.sql` in your Supabase SQL editor to create the necessary tables, policies, and university mappings.

6. **Create an admin user**
   Run this SQL to make your user an admin:
   ```sql
   INSERT INTO public.profiles (id, email, full_name, role, status)
   VALUES (
     'your_user_id_here',
     'your_email@example.com',
     'Your Name',
     'admin',
     'active'
   );
   ```

7. **Add test data (optional)**
   Run the SQL script in `test-data.sql` to add sample form submissions for testing.

8. **Run the development server**
   ```bash
   npm run dev
   ```

9. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/
│   ├── auth/
│   │   └── login/page.tsx          # Login page
│   ├── dashboard/
│   │   ├── page.tsx               # Main dashboard
│   │   ├── users/page.tsx         # User management
│   │   └── analytics/page.tsx     # Analytics and manual allocation
│   ├── layout.tsx                 # Root layout
│   └── page.tsx                   # Home page (redirects to login)
├── lib/
│   └── supabase.ts                # Supabase configuration
└── components/                    # Reusable components (to be added)
```

## Pages

### Authentication Pages
- **Login** (`/auth/login`): Sign in with email/password

### Dashboard
- **Main Dashboard** (`/dashboard`): Analytics overview with:
  - Overall performance statistics
  - LC ranking with bar charts
  - Form submission data table
  - Real-time statistics from database

### User Management (Admin Only)
- **Users** (`/dashboard/users`): User management interface with:
  - Add new users to Supabase Auth
  - Role and status management
  - Password setting for new users
  - User activation/deactivation

### Analytics (Admin Only)
- **Analytics** (`/dashboard/analytics`): Analytics and manual allocation with:
  - Manual LC allocation for unmapped universities
  - University mapping management
  - Form submission tracking

## Features in Detail

### Dashboard
- **Overall Performance**: Displays statistics from form submissions
- **LC Ranking**: Shows performance ranking of different Local Committees
- **Real-time Data**: Updates automatically from Supabase database
- **Beautiful UI**: Orange gradient background with glassmorphism design

### User Management (Admin Only)
- **Add Users**: Create new users directly in Supabase Auth
- **Role Management**: Assign admin/user roles
- **Status Control**: Activate/deactivate users
- **Password Management**: Set passwords for new users

### Analytics (Admin Only)
- **Manual Allocation**: Allocate LC codes to unmapped universities
- **University Mappings**: View all university-to-LC mappings
- **Form Management**: Handle form submissions from unknown universities

### Form Submission Tracking
- **Automatic LC Mapping**: Universities are automatically mapped to LCs based on predefined rules
- **Manual Allocation**: Unknown universities can be manually allocated to LCs
- **Statistics**: Track YE, APD, RE counts, revenue, and profit by LC

## Database Schema

### Tables
- **profiles**: User profiles with roles and status
- **form_submissions**: Form data with university and LC mapping
- **university_mapping**: Mapping between universities and LC codes
- **analytics**: Page tracking and analytics data

### LC Codes
- **Hanoi**: Hanoi universities
- **FHN**: Foreign Trade University and related institutions
- **NEU**: National Economics University and related institutions
- **HCMC**: Ho Chi Minh City universities
- **FHCMC**: Foreign Trade University HCMC and related institutions
- **HCME**: Economics and Law universities in HCMC
- **HCMS**: Science and Technology universities in HCMC
- **Cantho**: Can Tho universities
- **Danang**: Da Nang universities

## Database Setup

1. **Run the SQL script** in your Supabase SQL Editor:
   - Copy the contents of `database-setup.sql`
   - Paste it into the Supabase SQL Editor
   - Click "Run" to execute

2. **Create your first admin user**:
   - After running the script, go to Authentication > Users in Supabase
   - Find your user ID
   - Run this SQL to make yourself an admin:
   ```sql
   UPDATE public.profiles 
   SET role = 'admin', status = 'active' 
   WHERE id = 'your-user-id-here';
   ```

3. **Add test data (optional)**:
   - Run the contents of `test-data.sql` to add sample form submissions
   - This will help you test the dashboard functionality

4. **Verify setup**:
   - Check that all tables were created: `profiles`, `form_submissions`, `university_mapping`, `analytics`
   - Verify that Row Level Security (RLS) is enabled
   - Confirm that university mappings are populated

## Deployment

### Vercel (Recommended)
1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically

### Other Platforms
- Netlify
- Railway
- DigitalOcean App Platform

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support, email support@yourdomain.com or create an issue in the repository.
