-- Enforce max 1 job listing per company when not subscribed (free tier)
CREATE OR REPLACE FUNCTION check_employer_listing_limit()
RETURNS TRIGGER AS $$
DECLARE
  sub_status TEXT;
  listing_count INT;
BEGIN
  SELECT stripe_subscription_status INTO sub_status
  FROM companies
  WHERE id = NEW.company_id;

  IF sub_status IS NULL OR sub_status != 'active' THEN
    SELECT COUNT(*) INTO listing_count
    FROM job_listings
    WHERE company_id = NEW.company_id;

    IF listing_count >= 1 THEN
      RAISE EXCEPTION 'Upgrade to Growth plan to add more than one job listing.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_employer_listing_limit ON job_listings;
CREATE TRIGGER enforce_employer_listing_limit
  BEFORE INSERT ON job_listings
  FOR EACH ROW EXECUTE FUNCTION check_employer_listing_limit();
