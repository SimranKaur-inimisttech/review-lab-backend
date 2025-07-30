export interface HubSpotContact {
  id?: string;
  email?: string;
  firstname?: string;
  lastname?: string;
  company?: string;
  phone?: string;
  lifecyclestage?: 'subscriber' | 'lead' | 'customer' | 'evangelist';
  og01_user_id?: string;
  og01_plan_tier?: 'Starter Pro' | 'Premium' | 'Enterprise' | 'Agency';
  og01_signup_source?: 'Website Landing' | 'Direct App' | 'Referral';
  og01_subscription_status?: 'Active' | 'Cancelled' | 'Past Due' | 'Trialing';
  og01_total_spent?: number;
  og01_course_access_level?: 'Free Courses' | 'Premium Courses' | 'Enterprise Courses' | 'Agency Courses' | 'All Access Pass';
  og01_feature_addons?: string;
}

export interface HubSpotDeal {
  id?: string;
  dealname: string;
  amount: number;
  dealstage: string;
  pipeline: 'subscription' | 'course' | 'addon' | 'agency';
  og01_purchase_type?: 'upgrade' | 'addon' | 'course' | 'renewal';
  og01_stripe_payment_id?: string;
  og01_supabase_transaction_id?: string;
  closedate?: string;
  hubspot_owner_id?: string;
}

export interface HubSpotCompany {
  id?: string;
  name: string;
  domain?: string;
  og01_agency_tier?: boolean;
  og01_seat_count?: number;
  og01_company_id?: string;
}

export interface SyncResult {
  success: boolean;
  hubspotId?: string;
  error?: string;
  data?: Record<string, unknown>;
}
