-- Referral code per user (for "Invite a friend" link)
CREATE TABLE referral_codes (
  user_id UUID PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Referrals: when referred user signs up / completes Scout flow, referrer gets benefit
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referred_user_id)
);

CREATE INDEX idx_referral_codes_code ON referral_codes(code);
CREATE INDEX idx_referrals_referrer ON referrals(referrer_user_id);

ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own referral_code" ON referral_codes
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own referrals as referrer" ON referrals
  FOR SELECT USING (auth.uid() = referrer_user_id);
CREATE POLICY "Users can insert referral with self as referred" ON referrals
  FOR INSERT WITH CHECK (auth.uid() = referred_user_id);
CREATE POLICY "Users can view referral where they are referred" ON referrals
  FOR SELECT USING (auth.uid() = referred_user_id);
