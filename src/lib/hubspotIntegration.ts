import { supabaseAdmin } from '@/config/supabaseAdmin';
import {
  createContact,
  updateContact,
  searchContactByEmail,
  createDeal,
  createCompany,
  testConnection,
  isHubSpotSyncEnabled,
} from './hubspotClient';
import { HubSpotContact, HubSpotCompany, HubSpotDeal, SyncResult } from './types/hubspot';
import type { User } from '@supabase/supabase-js';
import { updateUserById } from './userService';

// ============================================
// TypeScript Interfaces
// ============================================

export interface UserProfile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  phone?: string;
  hubspot_contact_id?: string;
  hubspot_company_id?: string;
  subscription_tier?: string;
  subscription_status?: string;
  signup_source?: string;
  total_spent?: number;
  last_hubspot_sync?: string;
}

export interface SubscriptionData {
  tier: 'Starter Pro' | 'Premium' | 'Enterprise' | 'Agency';
  status: 'Active' | 'Cancelled' | 'Past Due' | 'Trialing';
  amount: number;
  billing_cycle: 'monthly' | 'yearly';
  stripe_subscription_id?: string;
}

export interface SyncLogEntry {
  user_id: string;
  hubspot_object_type: 'contact' | 'company' | 'deal';
  hubspot_object_id?: string;
  sync_type: 'create' | 'update' | 'delete';
  sync_direction: 'to_hubspot' | 'from_hubspot';
  status: 'success' | 'failed' | 'pending';
  error_message?: string;
  sync_data?: Record<string, unknown>;
}

// ============================================
// User Sync Functions
// ============================================

export const syncUserWithHubspot = async (user: User, additionalData?: Partial<UserProfile>): Promise<SyncResult> => {
  const signupSource = user.app_metadata?.provider === 'google' ? 'oauth_google' :
    user.app_metadata?.provider === 'github' ? 'oauth_github' :
      'Direct App';

  const contactData: Partial<HubSpotContact> = {
    email: user.email,
    firstname: user.user_metadata?.full_name.split(' ')[0] || '',
    lastname: user.user_metadata?.full_name.split(' ').slice(1).join(' ') || '',
    lifecyclestage: 'subscriber',
    og01_user_id: user.id,
    og01_plan_tier: 'Starter Pro',
    og01_signup_source: 'Direct App',
    og01_subscription_status: 'Trialing'
  };


  try {
    // Search for existing contact by email
    const existingContact = await searchContactByEmail(user.email!);

    let result: SyncResult;
    if (existingContact.success && existingContact.hubspotId) {
      // Update existing contact and save the ID
      result = await updateContact(existingContact.hubspotId, contactData);
      // Update Supabase with the found HubSpot contact ID
      await updateUserById({
        hubspot_contact_id: result.hubspotId,
        last_hubspot_sync: new Date().toISOString(),
      }, user?.id)
    } else {
      // Create new contact
      result = await createContact(contactData);
      // Update Supabase with the new HubSpot contact ID
      if (result.success && result.hubspotId) {
        await updateUserById({
          hubspot_contact_id: result.hubspotId,
          last_hubspot_sync: new Date().toISOString(),
          signup_source: signupSource
        }, user?.id)
      }
    }
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      data: undefined
    };
  }
};

// ============================================
// Subscription Sync Functions
// ============================================

export const syncSubscriptionToHubSpot = async (
  userId: string,
  subscriptionData: SubscriptionData,
  stripePaymentId?: string
): Promise<SyncResult> => {
  if (!isHubSpotSyncEnabled()) {
    return { success: true, hubspotId: 'sync_disabled' };
  }

  try {
    // Get user data
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('hubspot_contact_id, email, first_name, last_name')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      throw new Error('User not found');
    }

    // Update user subscription in Supabase
    await supabaseAdmin
      .from('users')
      .update({
        subscription_tier: subscriptionData.tier,
        subscription_status: subscriptionData.status,
        total_spent: supabaseAdmin.rpc('increment_total_spent', {
          user_id: userId,
          amount: subscriptionData.amount
        })
      })
      .eq('id', userId);

    // Create deal in HubSpot
    const dealData: HubSpotDeal = {
      dealname: `${subscriptionData.tier} Subscription - ${user.first_name} ${user.last_name}`,
      amount: subscriptionData.amount,
      dealstage: subscriptionData.status === 'Active' ? 'closedwon' : 'closedlost',
      pipeline: 'subscription',
      og01_purchase_type: 'upgrade',
      og01_stripe_payment_id: stripePaymentId,
      og01_supabase_transaction_id: userId,
      closedate: new Date().toISOString().split('T')[0]
    };

    const dealResult = await createDeal(dealData);

    // Update contact with new subscription info
    if (user.hubspot_contact_id) {
      await updateContact(user.hubspot_contact_id, {
        og01_plan_tier: subscriptionData.tier,
        og01_subscription_status: subscriptionData.status,
        lifecyclestage: 'customer'
      });
    }

    // Log the sync
    await logSyncOperation({
      user_id: userId,
      hubspot_object_type: 'deal',
      hubspot_object_id: dealResult.hubspotId,
      sync_type: 'create',
      sync_direction: 'to_hubspot',
      status: dealResult.success ? 'success' : 'failed',
      error_message: dealResult.error,
      sync_data: dealData as unknown as Record<string, unknown>
    });

    return dealResult;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during subscription sync';

    await logSyncOperation({
      user_id: userId,
      hubspot_object_type: 'deal',
      sync_type: 'create',
      sync_direction: 'to_hubspot',
      status: 'failed',
      error_message: errorMessage
    });

    return {
      success: false,
      error: errorMessage
    };
  }
};

// ============================================
// Company Sync Functions (for Agency Tier)
// ============================================

export const syncCompanyToHubSpot = async (
  userId: string,
  companyName: string,
  domain?: string,
  seatCount: number = 1
): Promise<SyncResult> => {
  if (!isHubSpotSyncEnabled()) {
    return { success: true, hubspotId: 'sync_disabled' };
  }

  try {
    // Create company in Supabase
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({
        name: companyName,
        domain,
        agency_tier: true,
        seat_count: seatCount,
        created_by: userId
      })
      .select()
      .single();

    if (companyError) {
      throw new Error(`Failed to create company: ${companyError.message}`);
    }

    // Create company in HubSpot
    const companyData: HubSpotCompany = {
      name: companyName,
      domain: domain,
      og01_agency_tier: true,
      og01_seat_count: seatCount,
      og01_company_id: company.id
    };

    const companyResult = await createCompany(companyData);

    // Update Supabase with HubSpot company ID
    if (companyResult.success && companyResult.hubspotId) {
      await supabaseAdmin
        .from('companies')
        .update({ hubspot_company_id: companyResult.hubspotId })
        .eq('id', company.id);

      // Associate user with company
      await supabaseAdmin
        .from('company_members')
        .insert({
          company_id: company.id,
          user_id: userId,
          role: 'owner'
        });

      // Update user's company association
      await supabaseAdmin
        .from('users')
        .update({ hubspot_company_id: companyResult.hubspotId })
        .eq('id', userId);
    }

    // Log the sync
    await logSyncOperation({
      user_id: userId,
      hubspot_object_type: 'company',
      hubspot_object_id: companyResult.hubspotId,
      sync_type: 'create',
      sync_direction: 'to_hubspot',
      status: companyResult.success ? 'success' : 'failed',
      error_message: companyResult.error,
      sync_data: companyData as unknown as Record<string, unknown>
    });

    return companyResult;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during company sync';

    await logSyncOperation({
      user_id: userId,
      hubspot_object_type: 'company',
      sync_type: 'create',
      sync_direction: 'to_hubspot',
      status: 'failed',
      error_message: errorMessage
    });

    return {
      success: false,
      error: errorMessage
    };
  }
};

// ============================================
// Sync Logging Functions
// ============================================

const logSyncOperation = async (logEntry: SyncLogEntry): Promise<void> => {
  try {
    await supabaseAdmin
      .from('hubspot_sync_log')
      .insert({
        user_id: logEntry.user_id,
        hubspot_object_type: logEntry.hubspot_object_type,
        hubspot_object_id: logEntry.hubspot_object_id,
        sync_type: logEntry.sync_type,
        sync_direction: logEntry.sync_direction,
        status: logEntry.status,
        error_message: logEntry.error_message,
        sync_data: logEntry.sync_data
      });
  } catch (error) {
    console.error('Failed to log sync operation:', error);
  }
};

// ============================================
// Utility Functions
// ============================================

export const getSyncHistory = async (userId: string, limit: number = 50) => {
  const { data, error } = await supabaseAdmin
    .from('hubspot_sync_log')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch sync history:', error);
    return { success: false, error: error.message };
  }

  return { success: true, data };
};

export const getSyncStats = async () => {
  const { data, error } = await supabaseAdmin
    .from('hubspot_sync_log')
    .select('status, hubspot_object_type, created_at')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    console.error('Failed to fetch sync stats:', error);
    return { success: false, error: error.message };
  }

  const stats = {
    total: data.length,
    successful: data.filter((log: any) => log.status === 'success').length,
    failed: data.filter((log: any) => log.status === 'failed').length,
    pending: data.filter((log: any) => log.status === 'pending').length,
    byType: {
      contact: data.filter((log: any) => log.hubspot_object_type === 'contact').length,
      company: data.filter((log: any) => log.hubspot_object_type === 'company').length,
      deal: data.filter((log: any) => log.hubspot_object_type === 'deal').length
    }
  };

  return { success: true, data: stats };
};

export const testHubSpotConnection = testConnection;

// ============================================
// Automatic User Registration Sync
// ============================================

export const handleUserRegistration = async (user: User): Promise<void> => {
  try {
    console.log('🎯 handleUserRegistration CALLED for:', user.email);
    console.log('🎯 User ID:', user.id);
    console.log('🎯 Processing user registration for HubSpot sync:', user.email);

    console.log('🔗 Starting HubSpot sync process...');
    const syncResult = await syncUserWithHubspot(user, {
      signup_source: 'direct_app'
    });

    console.log('📊 HubSpot sync result:', syncResult);

    if (syncResult.success) {
      console.log('✅ User successfully synced to HubSpot:', syncResult.hubspotId);
    } else {
      console.error('❌ Failed to sync user to HubSpot:', syncResult.error);

      // Check if it's a CORS error
      if (syncResult.error?.includes('CORS') || syncResult.error?.includes('NetworkError') || syncResult.error?.includes('Failed to fetch')) {
        console.warn('🚨 CORS Error Detected: HubSpot API calls blocked by browser security policy');
        console.warn('💡 This is expected in browser environment. In production, use server-side integration.');
      }
    }
  } catch (error) {
    console.error('❌ Error in user registration sync:', error);
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
  }
}; 