-- Create clearance table if it doesn't exist
CREATE TABLE IF NOT EXISTS clearance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID REFERENCES auth.users(id),
    amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'pending',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE clearance ENABLE ROW LEVEL SECURITY;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    metadata jsonb;
    user_role text;
BEGIN
    -- Get the user's metadata
    metadata := auth.jwt() ->> 'role';
    
    -- Check if the role is 'admin'
    RETURN metadata = 'admin';
EXCEPTION
    WHEN OTHERS THEN
        -- If there's any error, return false for safety
        RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Alternative function to check admin role from raw metadata
CREATE OR REPLACE FUNCTION is_admin_v2()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT CASE 
            WHEN raw_user_meta_data->>'role' = 'admin' THEN true
            ELSE false
        END
        FROM auth.users
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clean up all existing policies
DO $$
BEGIN
    -- Drop all policies for expenses
    DROP POLICY IF EXISTS "Admin users can insert expenses" ON expenses;
    DROP POLICY IF EXISTS "Admin users can update expenses" ON expenses;
    DROP POLICY IF EXISTS "Admin users can delete expenses" ON expenses;
    DROP POLICY IF EXISTS "Regular users can view expenses" ON expenses;
    DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON expenses;
    DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON expenses;
    DROP POLICY IF EXISTS "Enable update for users based on email" ON expenses;
    DROP POLICY IF EXISTS "Enable delete for users based on email" ON expenses;

    -- Drop all policies for users
    DROP POLICY IF EXISTS "Admin users can insert users" ON users;
    DROP POLICY IF EXISTS "Admin users can update users" ON users;
    DROP POLICY IF EXISTS "Admin users can delete users" ON users;
    DROP POLICY IF EXISTS "Everyone can read user data" ON users;
    DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON users;
    DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON users;
    DROP POLICY IF EXISTS "Enable update for users based on email" ON users;
    DROP POLICY IF EXISTS "Enable delete for users based on email" ON users;
    DROP POLICY IF EXISTS "Admin users can manage users" ON users;

    -- Drop all policies for sales
    DROP POLICY IF EXISTS "Admin users can insert sales" ON sales;
    DROP POLICY IF EXISTS "Admin users can update sales" ON sales;
    DROP POLICY IF EXISTS "Admin users can delete sales" ON sales;
    DROP POLICY IF EXISTS "Users can view sales" ON sales;
    DROP POLICY IF EXISTS "Admin users can manage sales" ON sales;

    -- Drop all policies for investments
    DROP POLICY IF EXISTS "Admin users can insert investments" ON investments;
    DROP POLICY IF EXISTS "Admin users can update investments" ON investments;
    DROP POLICY IF EXISTS "Admin users can delete investments" ON investments;
    DROP POLICY IF EXISTS "Users can view investments" ON investments;
    DROP POLICY IF EXISTS "Admin users can manage investments" ON investments;

    -- Drop all policies for cash_transactions
    DROP POLICY IF EXISTS "Admin users can insert cash transactions" ON cash_transactions;
    DROP POLICY IF EXISTS "Admin users can update cash transactions" ON cash_transactions;
    DROP POLICY IF EXISTS "Admin users can delete cash transactions" ON cash_transactions;
    DROP POLICY IF EXISTS "Users can view cash transactions" ON cash_transactions;
    DROP POLICY IF EXISTS "Admin users can manage cash transactions" ON cash_transactions;

    -- Drop all policies for loan_payments
    DROP POLICY IF EXISTS "Admin users can insert loan payments" ON loan_payments;
    DROP POLICY IF EXISTS "Admin users can update loan payments" ON loan_payments;
    DROP POLICY IF EXISTS "Admin users can delete loan payments" ON loan_payments;
    DROP POLICY IF EXISTS "Users can view loan payments" ON loan_payments;
    DROP POLICY IF EXISTS "Admin users can manage loan payments" ON loan_payments;

    -- Drop all policies for goods_purchases
    DROP POLICY IF EXISTS "Admin users can insert goods purchases" ON goods_purchases;
    DROP POLICY IF EXISTS "Admin users can update goods purchases" ON goods_purchases;
    DROP POLICY IF EXISTS "Admin users can delete goods purchases" ON goods_purchases;
    DROP POLICY IF EXISTS "Users can view goods purchases" ON goods_purchases;
    DROP POLICY IF EXISTS "Admin users can manage goods purchases" ON goods_purchases;

    -- Drop all policies for clearance
    DROP POLICY IF EXISTS "Admin users can insert clearance" ON clearance;
    DROP POLICY IF EXISTS "Admin users can update clearance" ON clearance;
    DROP POLICY IF EXISTS "Admin users can delete clearance" ON clearance;
    DROP POLICY IF EXISTS "Users can view their own clearance" ON clearance;
    DROP POLICY IF EXISTS "Users can view all clearance" ON clearance;
    DROP POLICY IF EXISTS "Admin users can manage clearance" ON clearance;
END $$;

-- EXPENSES POLICIES
CREATE POLICY "Admin users can insert expenses"
ON expenses FOR INSERT TO authenticated
WITH CHECK (is_admin() OR is_admin_v2());

CREATE POLICY "Admin users can update expenses"
ON expenses FOR UPDATE TO authenticated
USING (is_admin() OR is_admin_v2())
WITH CHECK (is_admin() OR is_admin_v2());

CREATE POLICY "Admin users can delete expenses"
ON expenses FOR DELETE TO authenticated
USING (is_admin() OR is_admin_v2());

CREATE POLICY "Regular users can view expenses"
ON expenses FOR SELECT TO authenticated
USING (true);

-- USERS POLICIES
-- Note: Main cleanup is done in the DO block above
CREATE POLICY "Everyone can read user data"
ON users FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admin users can insert users"
ON users FOR INSERT TO authenticated
WITH CHECK (is_admin() OR is_admin_v2());

CREATE POLICY "Admin users can update users"
ON users FOR UPDATE TO authenticated
USING (is_admin() OR is_admin_v2())
WITH CHECK (is_admin() OR is_admin_v2());

CREATE POLICY "Admin users can delete users"
ON users FOR DELETE TO authenticated
USING (is_admin() OR is_admin_v2());

-- SALES POLICIES
DROP POLICY IF EXISTS "Admin users can manage sales" ON sales;
DROP POLICY IF EXISTS "Users can view sales" ON sales;

CREATE POLICY "Admin users can insert sales"
ON sales FOR INSERT TO authenticated
WITH CHECK (is_admin() OR is_admin_v2());

CREATE POLICY "Admin users can update sales"
ON sales FOR UPDATE TO authenticated
USING (is_admin() OR is_admin_v2())
WITH CHECK (is_admin() OR is_admin_v2());

CREATE POLICY "Admin users can delete sales"
ON sales FOR DELETE TO authenticated
USING (is_admin() OR is_admin_v2());

CREATE POLICY "Users can view sales"
ON sales FOR SELECT TO authenticated
USING (true);

-- INVESTMENTS POLICIES
DROP POLICY IF EXISTS "Admin users can manage investments" ON investments;
DROP POLICY IF EXISTS "Users can view investments" ON investments;

CREATE POLICY "Admin users can insert investments"
ON investments FOR INSERT TO authenticated
WITH CHECK (is_admin() OR is_admin_v2());

CREATE POLICY "Admin users can update investments"
ON investments FOR UPDATE TO authenticated
USING (is_admin() OR is_admin_v2())
WITH CHECK (is_admin() OR is_admin_v2());

CREATE POLICY "Admin users can delete investments"
ON investments FOR DELETE TO authenticated
USING (is_admin() OR is_admin_v2());

CREATE POLICY "Users can view investments"
ON investments FOR SELECT TO authenticated
USING (true);

-- CASH TRANSACTIONS POLICIES
DROP POLICY IF EXISTS "Admin users can manage cash transactions" ON cash_transactions;
DROP POLICY IF EXISTS "Users can view cash transactions" ON cash_transactions;

CREATE POLICY "Admin users can insert cash transactions"
ON cash_transactions FOR INSERT TO authenticated
WITH CHECK (is_admin() OR is_admin_v2());

CREATE POLICY "Admin users can update cash transactions"
ON cash_transactions FOR UPDATE TO authenticated
USING (is_admin() OR is_admin_v2())
WITH CHECK (is_admin() OR is_admin_v2());

CREATE POLICY "Admin users can delete cash transactions"
ON cash_transactions FOR DELETE TO authenticated
USING (is_admin() OR is_admin_v2());

CREATE POLICY "Users can view cash transactions"
ON cash_transactions FOR SELECT TO authenticated
USING (true);

-- LOAN PAYMENTS POLICIES
DROP POLICY IF EXISTS "Admin users can manage loan payments" ON loan_payments;
DROP POLICY IF EXISTS "Users can view loan payments" ON loan_payments;

CREATE POLICY "Admin users can insert loan payments"
ON loan_payments FOR INSERT TO authenticated
WITH CHECK (is_admin() OR is_admin_v2());

CREATE POLICY "Admin users can update loan payments"
ON loan_payments FOR UPDATE TO authenticated
USING (is_admin() OR is_admin_v2())
WITH CHECK (is_admin() OR is_admin_v2());

CREATE POLICY "Admin users can delete loan payments"
ON loan_payments FOR DELETE TO authenticated
USING (is_admin() OR is_admin_v2());

CREATE POLICY "Users can view loan payments"
ON loan_payments FOR SELECT TO authenticated
USING (true);

-- GOODS PURCHASES POLICIES
DROP POLICY IF EXISTS "Admin users can manage goods purchases" ON goods_purchases;
DROP POLICY IF EXISTS "Users can view goods purchases" ON goods_purchases;

CREATE POLICY "Admin users can insert goods purchases"
ON goods_purchases FOR INSERT TO authenticated
WITH CHECK (is_admin() OR is_admin_v2());

CREATE POLICY "Admin users can update goods purchases"
ON goods_purchases FOR UPDATE TO authenticated
USING (is_admin() OR is_admin_v2())
WITH CHECK (is_admin() OR is_admin_v2());

CREATE POLICY "Admin users can delete goods purchases"
ON goods_purchases FOR DELETE TO authenticated
USING (is_admin() OR is_admin_v2());

CREATE POLICY "Users can view goods purchases"
ON goods_purchases FOR SELECT TO authenticated
USING (true);

-- CLEARANCE POLICIES
DROP POLICY IF EXISTS "Admin users can manage clearance" ON clearance;
DROP POLICY IF EXISTS "Users can view their own clearance" ON clearance;
DROP POLICY IF EXISTS "Users can view all clearance" ON clearance;

CREATE POLICY "Admin users can insert clearance"
ON clearance FOR INSERT TO authenticated
WITH CHECK (is_admin() OR is_admin_v2());

CREATE POLICY "Admin users can update clearance"
ON clearance FOR UPDATE TO authenticated
USING (is_admin() OR is_admin_v2())
WITH CHECK (is_admin() OR is_admin_v2());

CREATE POLICY "Admin users can delete clearance"
ON clearance FOR DELETE TO authenticated
USING (is_admin() OR is_admin_v2());

CREATE POLICY "Users can view their own clearance"
ON clearance FOR SELECT TO authenticated
USING (auth.uid() = member_id OR is_admin());
