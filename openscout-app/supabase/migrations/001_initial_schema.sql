-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  location TEXT,
  photo_url TEXT,
  professional_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Work experiences
CREATE TABLE work_experiences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  job_title TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  employment_type TEXT,
  location TEXT,
  is_remote BOOLEAN DEFAULT FALSE,
  description TEXT,
  highlights TEXT[] DEFAULT '{}',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Educations
CREATE TABLE educations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  institution TEXT NOT NULL,
  location TEXT,
  degree_type TEXT,
  field_of_study TEXT,
  start_year INT,
  end_year INT,
  completed BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job preferences
CREATE TABLE job_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  job_search_status TEXT,
  available_start TEXT,
  salary_expectation INT,
  work_arrangement TEXT,
  domain TEXT,
  experience_level TEXT,
  desired_roles TEXT[] DEFAULT '{}',
  skills TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Professional links
CREATE TABLE professional_links (
  user_id UUID PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  linkedin TEXT,
  github TEXT,
  portfolio TEXT,
  other_highlights TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Companies (for employers - minimal for job listings)
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job listings
CREATE TABLE job_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  requirements TEXT,
  min_cv_score INT DEFAULT 0,
  ai_interview_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CV analyses
CREATE TABLE cv_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  job_category TEXT NOT NULL,
  overall_score INT NOT NULL,
  category_scores JSONB DEFAULT '{}',
  strengths TEXT[] DEFAULT '{}',
  improvements TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mock interviews
CREATE TABLE mock_interviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  job_category TEXT NOT NULL,
  score INT,
  report JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job applications
CREATE TABLE job_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES job_listings(id) ON DELETE CASCADE,
  cv_score INT,
  interview_score INT,
  interview_report JSONB,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

-- Create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- RLS policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE educations ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE cv_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_listings ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update own
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Work experiences
CREATE POLICY "Users can manage own work_experiences" ON work_experiences FOR ALL USING (auth.uid() = user_id);

-- Educations
CREATE POLICY "Users can manage own educations" ON educations FOR ALL USING (auth.uid() = user_id);

-- Job preferences
CREATE POLICY "Users can manage own job_preferences" ON job_preferences FOR ALL USING (auth.uid() = user_id);

-- Professional links
CREATE POLICY "Users can manage own professional_links" ON professional_links FOR ALL USING (auth.uid() = user_id);

-- CV analyses
CREATE POLICY "Users can manage own cv_analyses" ON cv_analyses FOR ALL USING (auth.uid() = user_id);

-- Mock interviews
CREATE POLICY "Users can manage own mock_interviews" ON mock_interviews FOR ALL USING (auth.uid() = user_id);

-- Job applications
CREATE POLICY "Users can manage own job_applications" ON job_applications FOR ALL USING (auth.uid() = user_id);

-- Companies - public read for listings
CREATE POLICY "Anyone can view companies" ON companies FOR SELECT USING (true);

-- Job listings - public read
CREATE POLICY "Anyone can view active job_listings" ON job_listings FOR SELECT USING (is_active = true);
