
-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON profiles;
DROP POLICY IF EXISTS "Public Access" ON profiles;

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 1. VIEW: Allow users to view their own profile (and others if needed)
CREATE POLICY "Users can view profiles" 
ON profiles FOR SELECT 
USING ( true );

-- 2. INSERT: Allow users to insert their *own* profile
CREATE POLICY "Users can insert their own profile" 
ON profiles FOR INSERT 
WITH CHECK ( auth.uid() = id );

-- 3. UPDATE: Allow users to update their *own* profile
CREATE POLICY "Users can update their own profile" 
ON profiles FOR UPDATE 
USING ( auth.uid() = id );
