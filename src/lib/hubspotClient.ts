import Bottleneck from 'bottleneck';
import axios from 'axios';
import { HubSpotCompany, HubSpotContact, HubSpotDeal, SyncResult } from './types/hubspot';

// ============================================
// HubSpot Configuration
// ============================================

const HUBSPOT_CONFIG = {
  apiToken: process.env.HUBSPOT_API_TOKEN,
  portalId: process.env.HUBSPOT_PORTAL_ID,
  appId: process.env.HUBSPOT_APP_ID,
  clientId: process.env.HUBSPOT_CLIENT_ID,
  syncEnabled: process.env.HUBSPOT_SYNC_ENABLED === 'true',
  apiBase: process.env.HUBSPOT_API_BASE,
  retryAttempts: 3,
  rateLimitDelay: 100
};

// ============================================
// Rate Limiting Setup
// ============================================

const hubspotLimiter = new Bottleneck({
  reservoir: 100, // 100 requests
  reservoirRefreshAmount: 100,
  reservoirRefreshInterval: 10 * 1000, // per 10 seconds
  maxConcurrent: 5
});

// ============================================
// HubSpot API Client
// ============================================

class HubSpotClient {
  private apiToken: string;
  private baseUrl: string;

  constructor(apiToken: string, baseUrl: string) {
    this.apiToken = apiToken;
    this.baseUrl = baseUrl;
  }

  private async makeRequest(endpoint: string, method: string = 'GET', data?: Record<string, unknown>) {
    const config = {
      method,
      url: `${this.baseUrl}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      ...(data && { data })
    };
    
    const response = await axios(config);
    return response.data;
  }

  // Contacts API
  async getContacts(limit: number = 10) {
    return this.makeRequest(`/crm/v3/objects/contacts?limit=${limit}`);
  }

  async createContact(properties: Record<string, string>) {
    return this.makeRequest('/crm/v3/objects/contacts', 'POST', { properties });
  }

  async updateContact(contactId: string, properties: Record<string, string>) {
    return this.makeRequest(`/crm/v3/objects/contacts/${contactId}`, 'PATCH', { properties });
  }

  async getContactById(contactId: string, properties: string[] = []) {
    const propsQuery = properties.length > 0 ? `?properties=${properties.join(',')}` : '';
    return this.makeRequest(`/crm/v3/objects/contacts/${contactId}${propsQuery}`);
  }

  async searchContacts(filters: Record<string, unknown>) {
    return this.makeRequest('/crm/v3/objects/contacts/search', 'POST', filters);
  }

  // Companies API
  async getCompanies(limit: number = 10) {
    return this.makeRequest(`/crm/v3/objects/companies?limit=${limit}`);
  }

  async createCompany(properties: Record<string, string>) {
    return this.makeRequest('/crm/v3/objects/companies', 'POST', { properties });
  }

  // Deals API
  async getDeals(limit: number = 10) {
    return this.makeRequest(`/crm/v3/objects/deals?limit=${limit}`);
  }

  async createDeal(properties: Record<string, string>) {
    return this.makeRequest('/crm/v3/objects/deals', 'POST', { properties });
  }

  // Expose makeRequest for custom objects
  async request(endpoint: string, method: string = 'GET', data?: Record<string, unknown>) {
    return this.makeRequest(endpoint, method, data);
  }
}

const hubspotClient = new HubSpotClient(HUBSPOT_CONFIG.apiToken || '', HUBSPOT_CONFIG.apiBase || '');

// ============================================
// Utility Functions
// ============================================

const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = HUBSPOT_CONFIG.retryAttempts,
  delay: number = HUBSPOT_CONFIG.rateLimitDelay
): Promise<T> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: unknown) {
      if (i === maxRetries - 1) throw error;

      const backoffDelay = delay * Math.pow(2, i);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`HubSpot API retry ${i + 1}/${maxRetries} after ${backoffDelay}ms: ${errorMessage}`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
  throw new Error('Max retries exceeded');
};

const logSync = async (
  operation: string,
  success: boolean,
  data?: Record<string, unknown>,
  error?: string
) => {
  console.log(`HubSpot Sync [${operation}]:`, {
    success,
    timestamp: new Date().toISOString(),
    data: data ? JSON.stringify(data).slice(0, 200) + '...' : undefined,
    error
  });
};

// ============================================
// Contact Management Functions
// ============================================

export const createContact = async (contactData: HubSpotContact): Promise<SyncResult> => {
  if (!isHubSpotSyncEnabled()) {
    console.log('HubSpot sync disabled, skipping contact creation');
    return { success: true, hubspotId: 'sync_disabled' };
  }

  try {
    const properties = {
      email: contactData.email || '',
      firstname: contactData.firstname || '',
      lastname: contactData.lastname || '',
      company: contactData.company || '',
      phone: contactData.phone || '',
      lifecyclestage: contactData.lifecyclestage || 'subscriber',
      og01_user_id: contactData.og01_user_id || '',
      og01_plan_tier: contactData.og01_plan_tier || 'none',
      og01_signup_source: contactData.og01_signup_source || 'Direct App',
      og01_subscription_status: contactData.og01_subscription_status || 'inactive',
      og01_total_spent: contactData.og01_total_spent?.toString() || '0',
      og01_course_access_level: contactData.og01_course_access_level || 'Premium Courses',
    };

    const result = await hubspotLimiter.schedule(() =>
      retryWithBackoff(() => hubspotClient.createContact(properties))
    );

    await logSync('createContact', true, { contactId: result.id, email: contactData.email });

    return {
      success: true,
      hubspotId: result.id,
      data: result
    };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to create HubSpot contact';
    await logSync('createContact', false, contactData as unknown as Record<string, unknown>, errorMessage);

    return {
      success: false,
      error: errorMessage
    };
  }
};

export const updateContact = async (
  hubspotContactId: string,
  contactData: Partial<HubSpotContact>
): Promise<SyncResult> => {
  if (!isHubSpotSyncEnabled()) {
    return { success: true, hubspotId: hubspotContactId };
  }

  try {
    const properties: Record<string, string> = {};

    // Only include non-undefined values
    Object.entries(contactData).forEach(([key, value]) => {
      if (value !== undefined) {
        if (typeof value === 'number') {
          properties[key] = value.toString();
        } else if (typeof value === 'object') {
          properties[key] = JSON.stringify(value);
        } else {
          properties[key] = value.toString();
        }
      }
    });

    const result = await hubspotLimiter.schedule(() =>
      retryWithBackoff(() => hubspotClient.updateContact(hubspotContactId, properties))
    );

    await logSync('updateContact', true, { contactId: hubspotContactId, updates: properties });

    return {
      success: true,
      hubspotId: result.id,
      data: result
    };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update HubSpot contact';
    await logSync('updateContact', false, { contactId: hubspotContactId, data: contactData } as Record<string, unknown>, errorMessage);

    return {
      success: false,
      error: errorMessage
    };
  }
};

export const getContact = async (hubspotContactId: string): Promise<SyncResult> => {
  try {
    const result = await hubspotLimiter.schedule(() =>
      retryWithBackoff(() =>
        hubspotClient.getContactById(hubspotContactId, [
          'email', 'firstname', 'lastname', 'company', 'phone', 'lifecyclestage',
          'og01_user_id', 'og01_plan_tier', 'og01_signup_source',
          'og01_subscription_status', 'og01_total_spent',
          'og01_course_access_level', 'og01_feature_addons'
        ])
      )
    );

    return {
      success: true,
      hubspotId: result.id,
      data: result.properties
    };

  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch HubSpot contact'
    };
  }
};

export const searchContactByEmail = async (email: string): Promise<SyncResult> => {
  try {
    const searchRequest = {
      filterGroups: [{
        filters: [{
          propertyName: 'email',
          operator: 'EQ',
          value: email
        }]
      }],
      properties: [
        'email', 'firstname', 'lastname', 'company', 'phone', 'lifecyclestage',
        'og01_user_id', 'og01_plan_tier', 'og01_signup_source',
        'og01_subscription_status', 'og01_total_spent',
        'og01_course_access_level', 'og01_feature_addons'
      ],
      limit: 1
    };

    const result = await hubspotLimiter.schedule(() =>
      retryWithBackoff(() => hubspotClient.searchContacts(searchRequest))
    );

    if (result.results && result.results.length > 0) {
      const contact = result.results[0];
      return {
        success: true,
        hubspotId: contact.id,
        data: contact.properties
      };
    }

    return {
      success: false,
      error: 'Contact not found'
    };

  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search HubSpot contact'
    };
  }
};

// ============================================
// Deal Management Functions
// ============================================

export const createDeal = async (dealData: HubSpotDeal): Promise<SyncResult> => {
  if (!isHubSpotSyncEnabled()) {
    return { success: true, hubspotId: 'sync_disabled' };
  }

  try {
    const properties = {
      dealname: dealData.dealname,
      amount: dealData.amount.toString(),
      dealstage: dealData.dealstage,
      pipeline: dealData.pipeline,
      og01_purchase_type: dealData.og01_purchase_type || '',
      og01_stripe_payment_id: dealData.og01_stripe_payment_id || '',
      og01_supabase_transaction_id: dealData.og01_supabase_transaction_id || '',
      closedate: dealData.closedate || new Date().toISOString().split('T')[0]
    };

    const result = await hubspotLimiter.schedule(() =>
      retryWithBackoff(() => hubspotClient.createDeal(properties))
    );

    await logSync('createDeal', true, { dealId: result.id, dealName: dealData.dealname });

    return {
      success: true,
      hubspotId: result.id,
      data: result
    };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to create HubSpot deal';
    await logSync('createDeal', false, dealData as unknown as Record<string, unknown>, errorMessage);

    return {
      success: false,
      error: errorMessage
    };
  }
};

// ============================================
// Company Management Functions
// ============================================

export const createCompany = async (companyData: HubSpotCompany): Promise<SyncResult> => {
  if (!isHubSpotSyncEnabled()) {
    return { success: true, hubspotId: 'sync_disabled' };
  }

  try {
    const properties = {
      name: companyData.name,
      domain: companyData.domain || '',
      og01_agency_tier: companyData.og01_agency_tier ? 'true' : 'false',
      og01_seat_count: companyData.og01_seat_count?.toString() || '1',
      og01_company_id: companyData.og01_company_id || ''
    };

    const result = await hubspotLimiter.schedule(() =>
      retryWithBackoff(() => hubspotClient.createCompany(properties))
    );

    await logSync('createCompany', true, { companyId: result.id, name: companyData.name });

    return {
      success: true,
      hubspotId: result.id,
      data: result
    };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to create HubSpot company';
    await logSync('createCompany', false, companyData as unknown as Record<string, unknown>, errorMessage);

    return {
      success: false,
      error: errorMessage
    };
  }
};

// ============================================
// Connection Testing
// ============================================

export const testConnection = async (): Promise<SyncResult> => {
  try {
    console.log('Testing HubSpot connection...');

    // Test contact API access
    const contactsTest = await hubspotClient.getContacts(1);
    console.log('✅ HubSpot Contacts API: Connected');

    // Test companies API access
    const companiesTest = await hubspotClient.getCompanies(1);
    console.log('✅ HubSpot Companies API: Connected');

    // Test deals API access
    const dealsTest = await hubspotClient.getDeals(1);
    console.log('✅ HubSpot Deals API: Connected');

    return {
      success: true,
      data: {
        contacts: contactsTest.results?.length || 0,
        companies: companiesTest.results?.length || 0,
        deals: dealsTest.results?.length || 0,
        config: {
          portalId: HUBSPOT_CONFIG.portalId,
          syncEnabled: HUBSPOT_CONFIG.syncEnabled,
          apiTokenConfigured: !!HUBSPOT_CONFIG.apiToken
        }
      }
    };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'HubSpot connection test failed';
    console.error('❌ HubSpot API connection failed:', errorMessage);

    return {
      success: false,
      error: errorMessage
    };
  }
};

// ============================================
// Configuration Utilities
// ============================================

export const getHubSpotConfig = () => ({
  ...HUBSPOT_CONFIG,
  apiToken: HUBSPOT_CONFIG.apiToken ? '***configured***' : 'not configured'
});

export const isHubSpotConfigured = (): boolean => {
  return !!(HUBSPOT_CONFIG.apiToken && HUBSPOT_CONFIG.portalId);
};

export const isHubSpotSyncEnabled = (): boolean => {
  return HUBSPOT_CONFIG.syncEnabled && isHubSpotConfigured();
};

// Export the client for advanced usage
export { hubspotClient, hubspotLimiter };
