# OpenScout

AI-powered job search and interview platform.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` (copy from `.env.local.example`):
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
```

3. Set up Supabase database:
   - Create a new project in Supabase dashboard
   - Run `supabase/migrations/001_initial_schema.sql` in SQL Editor
   - Run `supabase/migrations/002_seed_demo.sql` in SQL Editor

4. Start the app:
```bash
npm run dev
```

## Features

- **Landing Page**: Hero, How It Works, FAQ
- **Auth**: Supabase Auth (Sign up / Log in)
- **5-Step Profile**: About, Work Experience, Education, Job Preferences, Links
- **CV Analysis**: PDF/TXT upload, AI evaluation, score and report
- **AI Mock Interview**: Job category selection, microphone test, voice interview (Web Speech API)
- **Job Listings**: List, detail, apply (CV score check + AI interview)
