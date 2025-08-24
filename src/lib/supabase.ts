import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Check if environment variables are set
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:', {
    url: supabaseUrl ? 'SET' : 'MISSING',
    key: supabaseAnonKey ? 'SET' : 'MISSING'
  });
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Create admin client with service role key for admin operations
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '';
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Pagination helper function
export const fetchWithPagination = async (table: string, options: {
  select?: string;
  orderBy?: { column: string; ascending?: boolean };
  filters?: Record<string, any>;
  pageSize?: number;
}) => {
  const { select = '*', orderBy, filters, pageSize = 1000 } = options;
  
  let query = supabase.from(table).select(select);
  
  // Apply filters
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    });
  }
  
  // Apply ordering
  if (orderBy) {
    query = query.order(orderBy.column, { ascending: orderBy.ascending ?? false });
  }
  
  // Fetch all data with pagination
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;
  
  while (hasMore) {
    const { data: page, error } = await query.range(from, from + pageSize - 1);
    
    if (error) {
      throw error;
    }
    
    if (page && page.length > 0) {
      allData = allData.concat(page);
      from += pageSize;
      hasMore = page.length === pageSize;
    } else {
      hasMore = false;
    }
  }
  
  return { data: allData, error: null };
};

// Auth helpers
export const signInWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  try {
    // Check if environment variables are set
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase environment variables are not configured');
    }

    const { data, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('Error getting user:', error);
      throw error;
    }

    if (!data.user) {
      throw new Error('No authenticated user found');
    }

    return data.user;
  } catch (error) {
    console.error('getCurrentUser error:', error);
    throw error;
  }
};

// Function to ensure user profile exists
export async function ensureUserProfile(userId: string, email: string, fullName?: string) {
  try {
    // Check if profile exists
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking profile:', checkError);
      return { error: checkError };
    }

    // If profile doesn't exist, create one
    if (!existingProfile) {
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert([{
          id: userId,
          email: email,
          full_name: fullName || '',
          role: 'user',
          status: 'pending'
        }])
        .select()
        .single();

      if (createError) {
        console.error('Error creating profile:', createError);
        return { error: createError };
      }

      return { data: newProfile };
    }

    return { data: existingProfile };
  } catch (error) {
    console.error('Error ensuring user profile:', error);
    return { error };
  }
}

// Function to check if user is admin
export async function isUserAdmin(userId: string) {
  try {
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error checking admin status:', error);
      return false;
    }

    if (!profile) {
      console.error('No profile found for user:', userId);
      return false;
    }

    
    // Check if user is active and has admin role
    const isAdmin = profile.status === 'active' && profile.role === 'admin';
    
    return isAdmin;
  } catch (error) {
    console.error('Error in isUserAdmin:', error);
    return false;
  }
}

// Function to get user profile with role check
export async function getUserProfile(userId: string) {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error getting user profile:', error);
      return { error };
    }

    if (!profile) {
      console.error('No profile found for user:', userId);
      return { error: new Error('Profile not found') };
    }

    return { data: profile };
  } catch (error) {
    console.error('Error in getUserProfile:', error);
    return { error };
  }
}

// Function to debug and fix admin issues
export async function debugAdminAccess(userId: string) {
  try {
    
    // Check if user exists in auth
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
    
    // Check profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    
    
    if (profile) {
      
      // Check if we need to update the profile
      if (profile.role !== 'admin' || profile.status !== 'active') {
        
        const { data: updatedProfile, error: updateError } = await supabase
          .from('profiles')
          .update({ role: 'admin', status: 'active' })
          .eq('id', userId)
          .select()
          .single();
        
        
        return { success: true, updated: true, profile: updatedProfile };
      }
    }
    
    return { success: true, updated: false, profile };
  } catch (error) {
    console.error('Debug error:', error);
    return { success: false, error };
  }
}
