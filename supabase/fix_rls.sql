
-- Enable RLS on profiles if not already enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own profile (e.g. on first login/save)
CREATE POLICY "Users can insert their own profile" 
ON profiles FOR INSERT 
WITH CHECK ( auth.uid() = id );

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile" 
ON profiles FOR UPDATE 
USING ( auth.uid() = id );

-- Allow users to see their own profile (and potentially others if needed for team view)
CREATE POLICY "Users can view profiles" 
ON profiles FOR SELECT 
USING ( true );
