-- Employer subscription: gate posting and viewing applications behind paid plan
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_status TEXT;

-- status: 'active' | 'canceled' | 'past_due' | null (null = not subscribed)
