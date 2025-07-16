-- ==============================
-- COMPLETE BACKEND FUNCTIONALITY FOR FINANCE TRACKER APP
-- ==============================

-- ========== USERS TABLE (if needed explicitly) ==========
-- Note: Supabase provides 'auth.users' by default. Use it directly.

-- ========== 1. PRODUCTS TABLE ==========
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL,
  category TEXT,
  availability TEXT DEFAULT 'in-stock',
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========== 2. PRODUCT REQUESTS TABLE ==========
CREATE TABLE IF NOT EXISTS product_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid REFERENCES auth.users(id),
  total_amount NUMERIC(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending',
  payment_status TEXT DEFAULT 'pending',
  paid_amount NUMERIC(10, 2) DEFAULT 0,
  special_instructions TEXT,
  request_date TIMESTAMP DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========== 3. PRODUCT REQUEST ITEMS TABLE ==========
CREATE TABLE IF NOT EXISTS product_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES product_requests(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
  product_name TEXT,
  quantity INT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========== 4. SALES TABLE ==========
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid REFERENCES auth.users(id),
  amount NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========== 5. EXPENSES TABLE ==========
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  date TIMESTAMP DEFAULT now(),
  description TEXT
);

-- ========== 6. NOTIFICATIONS TABLE ==========
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========== 7. TIMESTAMP TRIGGER FUNCTION ==========
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========== 8. TRIGGERS FOR AUTO UPDATE ==========
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER set_timestamp_request
BEFORE UPDATE ON product_requests
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ========== 9. BUSINESS LOGIC TRIGGERS (Example) ==========
-- When request is accepted, generate notification
CREATE OR REPLACE FUNCTION notify_request_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' THEN
    INSERT INTO notifications(user_id, title, message)
    VALUES (
      NEW.reseller_id,
      'Request Approved',
      'Your product request has been approved.'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_request
AFTER UPDATE ON product_requests
FOR EACH ROW EXECUTE FUNCTION notify_request_approval();

-- ========== 10. VIEWS FOR DASHBOARD ==========
CREATE OR REPLACE VIEW reseller_sales_summary AS
SELECT 
  reseller_id,
  COUNT(*) AS total_sales,
  SUM(amount) AS total_revenue
FROM sales
GROUP BY reseller_id;

CREATE OR REPLACE VIEW reseller_expenses_summary AS
SELECT 
  type,
  category,
  SUM(amount) AS total_spent
FROM expenses
GROUP BY type, category;
