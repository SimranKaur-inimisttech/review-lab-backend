import { supabaseAdmin } from '@/config/supabaseAdmin';
import { keywordCacheService } from './keywordCacheService';
import axios, { AxiosResponse } from 'axios';
import { capitalizeFirst, formatDate } from '@/utils/helpers';
import { backlinkCacheService } from './backlinkCacheService';

// =============================================================================
// SIMPLIFIED SEMRUSH API SERVICE - FUNCTIONAL VERSION
// =============================================================================

export interface DomainOverview {
    domain: string;
    organicKeywords: number;
    organicTraffic: number;
    organicCost: number;
    authorityScore: number;
    backlinks: number;
}

export interface KeywordData {
    keyword: string;
    searchVolume: number;
    keywordDifficulty: number;
    cpc: number;
    competition: number;
    competitionLevel: 'low' | 'medium' | 'high';
    database?: string; // Add database info
}

export interface RelatedKeyword {
    keyword: string;
    searchVolume: number;
    keywordDifficulty: number;
    cpc: number;
    competition: number;
    competitionLevel: 'low' | 'medium' | 'high';
    relevance: number;
    database?: string;
}
export interface BacklinkOverview {
    totalBacklinks: number;
    totalReferringDomains: number;
    doFollowLinks: number;
    noFollowLinks: number;
    averageDomainAuthority: number;
    toxicityScore: number;
    newBacklinks: number;
    lostBacklinks: number;
}

export interface BacklinkCometitorData {
    domain: string,
    totalBacklinks: number;
    totalReferringDomains: number;
    similarity: number;
    commonRefdomains: number;
    averageDomainAuthority: number;
}
export interface Backlink {
    id: string;
    sourceDomain: string;
    sourceUrl: string;
    targetUrl: string;
    anchorText: string;
    doFollow: boolean;
    domainAuthority: number;
    pageAuthority: number;
    firstSeen: string;
    lastSeen: string;
    status: 'broken' | 'new' | 'lost' | 'active';
    type: 'form' | 'frame' | 'image' | 'nofollow' | 'dofollow' | 'sitewide' | 'text';
}
export interface ReferringDomain {
    domain: string;
    backlinksCount: number;
    domainAuthority: number;
    firstSeen: string;
    lastSeen: string;
    followLinks: number;
    nofollowLinks: number;
}
export interface Prospect {
    id: string;
    domain: string;
    url: string;
    title?: string;
    domainAuthority: number;
    relevanceScore: number;
    source: 'keywords' | 'competitors' | 'manual' | 'upload' | 'backlink-gap';
    status: 'new' | 'in-progress' | 'contacted' | 'responded' | 'success' | 'rejected';
    value: 'high' | 'medium' | 'low';
    contact?: any | null;
    notes?: string;
    dateAdded: string;
    lastUpdated: string;
}
export interface KeywordTableData {
    user_id: string;
    keyword: string;
    search_volume: number;
    keyword_difficulty: number;
    cpc: number;
    competition: number;
    competition_level: 'low' | 'medium' | 'high';
    database?: string;
}

export class SEMrushError extends Error {
    constructor(
        message: string,
        public statusCode?: number,
        public endpoint?: string,
        public originalError?: Error
    ) {
        super(message);
        this.name = 'SEMrushError';
    }
}

export class RateLimitError extends SEMrushError {
    constructor(message: string, public retryAfter?: number) {
        super(message, 429);
        this.name = 'RateLimitError';
    }
}

export class QuotaExceededError extends SEMrushError {
    constructor(message: string, public quotaType: string) {
        super(message, 402);
        this.name = 'QuotaExceededError';
    }
}

export class SEMrushService {
    private apiKey: string;
    private baseUrl = 'https://api.semrush.com';
    private maxRetries: number;
    private retryDelay: number;

    constructor(apiKey?: string, maxRetries?: number, retryDelay?: number) {
        this.apiKey = apiKey || process.env.SEMRUSH_API_KEY || '';
        this.maxRetries = maxRetries || 3;
        this.retryDelay = retryDelay || 1000;

        if (!this.apiKey) {
            throw new Error('SEMrush API key is required');
        }
    }

    // Check if user has quota remaining for API call
    async checkQuota(userId: string, apiEndpoint: string, creditsRequired: number = 1): Promise<boolean> {
        try {
            // Get user's subscription tier
            const { data: user, error: userError } = await supabaseAdmin
                .from('users')
                .select('subscription_tier')
                .eq('id', userId)
                .single();

            if (userError || !user) {
                throw new QuotaExceededError('User not found', apiEndpoint);
            }

            // Get tier limits
            const { data: tierLimits, error: tierError } = await supabaseAdmin
                .from('tier_api_limits')
                .select('*')
                .eq('tier_name', user.subscription_tier)
                .single();

            if (tierError || !tierLimits) {
                throw new QuotaExceededError('Tier limits not found', apiEndpoint);
            }

            // Get current usage
            const currentMonth = new Date().getMonth() + 1;
            const currentYear = new Date().getFullYear();

            const { data: usage } = await supabaseAdmin
                .from('api_quota_usage')
                .select('*')
                .eq('user_id', userId)
                .eq('billing_month', currentMonth)
                .eq('billing_year', currentYear)
                .single();

            // Check specific endpoint limits
            const endpointLimits: Record<string, string> = {
                'keyword_research': 'keyword_research_limit',
                'website_audit': 'website_audit_limit',
                'backlink_analysis': 'backlink_analysis_limit',
                'competitor_analysis': 'competitor_analysis_limit',
                'rank_tracking': 'rank_tracking_limit'
            };

            // Check specific limits
            const limitColumn = endpointLimits[apiEndpoint];
            const usedColumn = limitColumn?.replace('_limit', '_used');

            if (!limitColumn || !usedColumn) {
                throw new QuotaExceededError('Unknown API endpoint', apiEndpoint);
            }

            const currentUsage = usage?.[usedColumn] || 0;
            const limit = tierLimits[limitColumn] || 0;

            // Check per-endpoint limit first
            if (currentUsage + creditsRequired > limit) {
                throw new QuotaExceededError(
                    `${apiEndpoint} quota exceeded. Used: ${currentUsage}/${limit}`,
                    apiEndpoint
                );
            }

            // Check total credits limit next
            const totalUsed = usage?.total_credits_used || 0;
            const totalLimit = tierLimits.total_credits_limit || 0;

            if (totalUsed + creditsRequired > totalLimit) {
                throw new QuotaExceededError(
                    `Total credits quota exceeded. Used: ${totalUsed}/${totalLimit}`,
                    apiEndpoint
                );
            }

            return true;
        } catch (error) {
            if (error instanceof QuotaExceededError) {
                throw error;
            }
            console.error('Quota check failed:', error);
            return false;
        }
    }

    // Log API usage for billing tracking
    async logUsage(
        userId: string,
        apiEndpoint: string,
        requestType: string,
        status: 'success' | 'failed' | 'rate_limited' | 'quota_exceeded',
        creditsConsumed: number = 1,
        targetDomain?: string,
        targetKeyword?: string,
        errorMessage?: string
    ): Promise<void> {
        try {
            const currentMonth = new Date().getMonth() + 1;
            const currentYear = new Date().getFullYear();

            // Log the API call
            await supabaseAdmin.from('api_usage_logs').insert({
                user_id: userId,
                team_id: null,
                api_endpoint: apiEndpoint,
                api_provider: 'semrush',
                request_type: requestType,
                credits_consumed: creditsConsumed,
                target_domain: targetDomain?.includes('.') ? targetDomain : null,
                target_keyword: targetKeyword,
                status,
                error_message: errorMessage,
                billing_month: currentMonth,
                billing_year: currentYear
            });

            // Update quota usage
            await supabaseAdmin.rpc('upsert_api_quota', {
                p_user_id: userId,
                p_month: currentMonth,
                p_year: currentYear,
                p_api_type: apiEndpoint,
                p_credits: creditsConsumed
            });
        } catch (error) {
            console.error('Failed to log API usage:', error);
        }
    }

    // Make API request to SEMrush (correct format)
    private async makeApiRequest(
        endPoint: string,
        params: Record<string, string>,
        userId: string,
        apiEndpoint: string,
        requestType: string,
        creditsRequired: number = 1,
        method: 'GET' | 'POST' = 'GET'
    ): Promise<any> {
        // Only check quota if cache is empty
        await this.checkQuota(userId, apiEndpoint, creditsRequired);

        const url = new URL(endPoint, this.baseUrl);
        url.searchParams.append('key', this.apiKey);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && key !== 'domain') {
                url.searchParams.append(key, String(value));
            }
        });

        let lastError: Error = new Error('Unknown error');

        // for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        try {
            let response: AxiosResponse;
            console.log('semrush request ====>', url.toString());
            if (method === 'POST') {
                response = await axios.post(url.toString());
            } else {
                response = await axios.get(url.toString());
            }

            // Success logging
            await this.logUsage(
                userId, apiEndpoint, requestType, 'success', creditsRequired,
                params.domain || params.target, params.phrase
            );

            return response.data;
            if (requestType == 'Backlinks_overview') {
                return `ascore;total;domains_num;urls_num;follows_num;nofollows_num
                              74;22063983;49145;13059030;47793;22956`;
            } else if (requestType == 'Backlinks_comparison') {
                return `ascore;neighbour;similarity;common_refdomains;domains_num;backlinks_num
                74;searchenginewatch.com;34;11537;47115;35855777
                68;wordstream.com;32;9575;37065;1750926
                77;moz.com;31;15732;103754;21136846
                80;searchengineland.com;36;17584;79939;42840590
                76;marketingland.com;30;9058;39986;9756098`;
            } else if (requestType == 'Backlinks') {
                if (params.display_offset == '0') {
                    return `source_url;target_url;anchor;nofollow;page_ascore;first_seen;last_seen;response_code;newlink;lostlink;form;frame;image;sitewide
                    https://rule34.dev/video;https://yourdomain.com/video;;false;88;1748797597;1753673475;301;false;true;false;false;false;false
                    https://github.com/Schepp/CSS-Filters-Polyfill;http://www.yourdomain.com/;www.yourdomain.com;true;85;1750515079;1750515079;200;false;false;false;false;false;false`
                } else if (params.display_offset == '2') {
                    return `source_url;target_url;anchor;nofollow;page_ascore;first_seen;last_seen;response_code;newlink;lostlink;form;frame;image;sitewide
                    https://stacks-on-stacks.com/disc-golf-flight-chart-playground;https://yourdomain.com/flight-chart-playground;;false;83;1758177750;1758177750;200;true;false;false;false;false;false
                    https://replmarket.com/shop/list.php?ca_id=011&page_rows&sort=index_no&sortodr=desc;https://www.yourdomain.com/;;false;82;1757505956;1758932740;200;false;false;false;false;true;false`
                } else if (params.display_offset == '4') {
                    return `source_url;target_url;anchor;nofollow;page_ascore;first_seen;last_seen;response_code;newlink;lostlink;form;frame;image;sitewide
                    http://universaldependencies.org/conll17/;http://yourdomain.com/conll17/;;false;81;1684464406;1750211596;200;false;true;false;false;false;false
                    http://universaldependencies.org/conll17/;https://yourdomain.com/conll17/;;false;81;1755114370;1755114370;200;false;false;false;false;false;false`
                }
            }
            // else if (requestType == 'backlinks_refdomains') {
            //     return `domain_ascore;domain;backlinks_num;ip;country;first_seen;last_seen
            // 5;seooptimizationdirectory.com;2134;103.243.170.2;nz;1735697975;1761625305
            // 6;addirectory.org;1158;107.161.23.26;us;1735747664;1761607897`
            // }
        } catch (error: any) {
            if (axios.isAxiosError(error) && error.response) {
                const status = error.response.status;

                if (status === 429) {
                    const retryAfter = parseInt(error.response.headers['retry-after'] || '60', 10);
                    await this.logUsage(
                        userId, apiEndpoint, requestType, 'rate_limited', 0, params.domain, params.phrase || params.target, `Rate limited, retry after ${retryAfter}s`
                    );
                    throw new RateLimitError('Rate limited by SEMrush API', retryAfter);
                }

                if (status === 402) {
                    await this.logUsage(
                        userId, apiEndpoint, requestType, 'quota_exceeded', 0, params.domain, params.phrase || params.target, 'SEMrush API quota exceeded'
                    );
                    throw new QuotaExceededError('SEMrush API quota exceeded', apiEndpoint);
                }

                lastError = new SEMrushError(
                    `SEMrush API error: ${status} ${error.response.statusText}`, status
                );
            } else {
                lastError = error instanceof Error ? error : new Error(String(error));
            }

            // if (attempt < this.maxRetries) {
            //     const delay = this.retryDelay * (attempt + 1);
            //     await new Promise((resolve) => setTimeout(resolve, delay));
            //     continue;
            // }
        }
        // }

        // Log failed API call after retries
        await this.logUsage(
            userId, apiEndpoint, requestType, 'failed', 0, params.domain, params.phrase || params.target, lastError.message);

        throw new SEMrushError(
            `Failed to make request after ${this.maxRetries + 1
            } attempts: ${lastError.message}`,
            undefined, apiEndpoint, lastError
        );
    }

    // Get domain overview data (with optional database parameter)
    async getDomainOverview(domain: string, userId: string, database?: string): Promise<DomainOverview> {

        const params: Record<string, string> = {
            domain,
            export_columns: 'Dn,Rk,Or,Ot,Oc,Ad,At,Ac'
        };

        // Add database parameter only if specified (defaults to global)
        if (database) {
            params.database = database;
        }

        const csvData = await this.makeApiRequest('domain_rank', params, userId, 'competitor_analysis', 'domain_overview', 2);

        return this.transformDomainOverview(csvData);
    }

    // Get keyword data (with optional database parameter)
    async getKeywordData(keyword: string, userId: string, database: string): Promise<KeywordData> {

        const params: Record<string, string> = {
            type: 'phrase_this',
            phrase: keyword,
            export_columns: 'Ph,Nq,Cp,Co,Kd'
        };

        // Add database parameter only if specified
        if (database) {
            params.database = database;
        }

        // Check cache first
        const cachedData = await keywordCacheService.get('keywords', keyword, database);
        if (
            cachedData &&
            cachedData.search_volume !== undefined &&
            cachedData.keyword_difficulty !== undefined &&
            cachedData.cpc !== undefined
        ) {
            return this.formatKeywordResponse(cachedData)
        }

        const csvData = await this.makeApiRequest('', params, userId, 'keyword_research', 'keyword_overview', 1);

        const parsedData = this.transformKeywordData(csvData, database);

        const tableData = this.formatKeywordTableData(parsedData, userId)

        // Store in cache
        await keywordCacheService.set('keywords', tableData, 36);
        return this.transformKeywordData(csvData, database);
    }

    // Get global keyword data specifically (uses phrase_all endpoint)
    async getGlobalKeywordData(keyword: string, userId: string): Promise<KeywordData> {
        const params: Record<string, string> = {
            type: 'phrase_all',
            phrase: keyword,
            export_columns: 'Db,Ph,Nq,Cp,Co,Kd'
        };

        // Check cache first
        const cachedData = await keywordCacheService.get('keywords', keyword, 'global');
        if (cachedData) {
            return this.formatKeywordResponse(cachedData)
        }

        // Use phrase_all for global data across all databases
        const csvData = await this.makeApiRequest('', params, userId, 'keyword_research', 'keyword_research', 1);

        const parsedData = this.transformGlobalKeywordData(csvData);

        const tableData = this.formatKeywordTableData(parsedData, userId)

        // Store in cache
        await keywordCacheService.set('keywords', tableData, 36);
        return parsedData;
    }

    // Get country-specific keyword data
    async getCountryKeywordData(keyword: string, userId: string, countryCode: string): Promise<KeywordData> {
        return this.getKeywordData(keyword, userId, countryCode);
    }

    /**
     * Fetch related keywords / keyword variations from SEMrush with pagination support.
     */
    async getRelatedKeywords(
        keyword: string,
        userId: string,
        database: string,
        limit: number = 20,
        offset: number = 0
    ): Promise<RelatedKeyword[]> {

        const page = Math.floor(offset / limit) + 1; // calculate current page

        const params: Record<string, string> = {
            type: 'phrase_related',
            phrase: keyword,
            export_columns: 'Ph,Nq,Cp,Co,Kd,Rr',
            display_limit: (limit * page).toString(),
        };

        // Add offset for pagination when requested (>0)
        if (offset > 0) {
            params.display_offset = offset.toString();
        }

        // Add database parameter only if specified
        if (database && database !== 'global') {
            params.database = database;
        }

        // Check cache first
        const cachedData = await keywordCacheService.get('keywords', keyword, database);
        if (!!cachedData?.related_keywords) {
            const cachedPageData = cachedData.related_keywords.filter((rk: any) => rk.page === page);
            if (cachedPageData.length > 0) {
                return cachedPageData;
            }
        }

        const csvData = await this.makeApiRequest('', params, userId, 'keyword_research', 'keyword_research', 1);

        // check for Not found error message
        if (csvData.includes('ERROR 50 :: NOTHING FOUND')) {
            console.warn(`No related keywords found for "${keyword}" in "${database || 'global'}"`);
            return [];
        }

        const parsedData = this.transformRelatedKeywords(csvData, database);

        // Attach page to each keyword JSON
        const relatedWithPage = parsedData.map(data => ({ ...data, page }))
        // Store in cache
        await keywordCacheService.set('keywords', { ...cachedData, keyword, database, user_id: userId, related_keywords: [...(cachedData?.related_keywords || []), ...relatedWithPage] }, 36);

        return parsedData
    }

    // Get backlink analytics data (using domain backlinks overview as example)
    async getBacklinkOverview(domain: string, userId: string, onlyProfile: boolean): Promise<any> {
        const params: Record<string, string> = {
            type: 'backlinks_overview',
            target: domain,
            target_type: 'root_domain',
            export_columns: 'ascore,total,domains_num,urls_num,follows_num,nofollows_num'
        };
        // Check cache first
        const overviewCache = await backlinkCacheService.get('backlink_cache', domain, 'overview', 'global');

        if (overviewCache) {
            if (onlyProfile) return { profile: overviewCache.data };
            // Fetch competitor + backlinks (from their own caches or API)
            const [competitorsBacklinkData, backlinks] = await Promise.all([
                this.getBacklinkCompetitorsData(domain, userId),
                this.getBacklinks(domain, userId)
            ]);

            return {
                profile: overviewCache.data,
                competitorsBacklinkData,
                backlinks
            };
        }

        const overviewData = await this.makeApiRequest(`/analytics/v1/`, params, userId, 'backlink_analysis', 'Backlinks_overview', 2);

        const parsedData = this.transformBacklinkOverview(overviewData);

        // Store in cache
        await backlinkCacheService.set('backlink_cache', { user_id: userId, domain, data_type: 'overview', database_region: 'global', data: parsedData }, 24);

        // If only profile requested, stop here
        if (onlyProfile) {
            return { profile: parsedData };
        }

        // Fetch other data (they handle their own cache)
        const [competitorsBacklinkData, backlinks] = await Promise.all([
            this.getBacklinkCompetitorsData(domain, userId),
            this.getBacklinks(domain, userId)
        ]);

        return {
            profile: parsedData,
            competitorsBacklinkData,
            backlinks
        };
    }

    // Get backlink competitor data
    async getBacklinkCompetitorsData(domain: string, userId: string, limit: number = 3,
        offset: number = 0): Promise<BacklinkCometitorData[]> {
        const params: Record<string, string> = {
            type: 'backlinks_competitors',
            target: domain,
            target_type: 'root_domain',
            export_columns: 'ascore,neighbour,similarity,common_refdomains,domains_num,backlinks_num',
            display_limit: limit.toString(),
            display_offset: offset.toString()
        };
        // Check cache first
        const cachedData = await backlinkCacheService.get('competitor_backlink_cache', domain, 'Backlinks_comparison', 'global');
        if (cachedData) {
            return cachedData.data;
        }
        const csvData = await this.makeApiRequest(`/analytics/v1/`, params, userId, 'competitor_analysis', 'Backlinks_comparison', 5 * limit);

        const parsedData = this.transformBacklinkCometitorsData(csvData);

        // Store in cache
        await backlinkCacheService.set('competitor_backlink_cache', { user_id: userId, domain, data_type: 'Backlinks_comparison', database_region: 'global', data: parsedData }, 6);

        return parsedData;
    }

    // Get backlink analytics data (using domain backlinks overview as example)
    async getBacklinks(domain: string, userId: string, limit: number = 20,
        offset: number = 0): Promise<Backlink[]> {
        const params: Record<string, string> = {
            type: 'backlinks',
            target: domain,
            target_type: 'root_domain',
            export_columns: 'source_url,target_url,anchor,nofollow,page_ascore,first_seen,last_seen,response_code,newlink,lostlink,form,frame,image,sitewide',
            display_limit: limit.toString(),
            display_offset: offset.toString()
        };

        const page = Math.floor(offset / limit) + 1; // calculate current page

        // Check cache first
        const cachedData = await backlinkCacheService.get('backlink_cache', domain, 'backlinks', 'global');

        if (cachedData) {
            const backlinks = cachedData.data.filter((bk: any) => bk.page === page);;
            if (backlinks.length > 0) {
                return backlinks;
            }
        }
        const creditsUsed = (limit / 100) * 3;

        const csvData = await this.makeApiRequest(`/analytics/v1/`, params, userId, 'backlink_analysis', 'Backlinks', creditsUsed);

        const parsedData = this.transformBacklinksData(csvData);
        // Attach page to each keyword JSON
        const backlinksWithPage = parsedData.map(data => ({ ...data, page }))

        // Store in cache
        await backlinkCacheService.set('backlink_cache', {
            user_id: userId,
            domain,
            data_type: 'backlinks',
            database_region: 'global',
            data: [...(cachedData?.data || []), ...backlinksWithPage]
        }, 12);

        return parsedData;

    }

    // Get Backlinks Referring domains
    async getReferringDomains(domain: string, userId: string, limit: number = 20,
        offset: number = 0): Promise<ReferringDomain[]> {
        const params: Record<string, string> = {
            type: 'backlinks_refdomains',
            target: domain,
            target_type: 'root_domain',
            export_columns: 'domain_ascore,domain,backlinks_num,ip,country,first_seen,last_seen',
            display_limit: limit.toString(),
            display_offset: offset.toString()
        };

        const page = Math.floor(offset / limit) + 1; // calculate current page
        // Check cache first
        const cachedData = await backlinkCacheService.get('backlink_cache', domain, 'referring_domains', 'global');
        console.log('Cached referring domains data:', cachedData);

        if (cachedData) {
            const backlinks = cachedData.data.filter((bk: any) => bk.page === page);;
            if (backlinks.length > 0) {
                return backlinks;
            }
        }
        const creditsUsed = (limit / 100) * 2;

        const csvData = await this.makeApiRequest(`/analytics/v1/`, params, userId, 'backlink_analysis', 'backlinks_refdomains', creditsUsed);

        const parsedData = this.transformReferringDomainsData(csvData);

        // Attach page to each keyword JSON
        const backlinksWithPage = parsedData.map(data => ({ ...data, page }))

        // Store in cache
        await backlinkCacheService.set('backlink_cache', {
            user_id: userId,
            domain,
            data_type: 'referring_domains',
            database_region: 'global',
            data: [...(cachedData?.data || []), ...backlinksWithPage]
        }, 12);

        return parsedData;

    }

    // Get backlink gap analysis 
    async getBacklinkGap(
        targetDomain: string,
        competitors: string[],
        userId: string,
        limit: number = 20,
        offset: number = 0
    ): Promise<Prospect[]> {
        const now = new Date().toISOString();
        const page = Math.floor(offset / limit) + 1;

        const perCompetitorLimit = Math.ceil(limit / competitors.length);

        // Get your referring domains
        const yourRefDomains = await this.getReferringDomains(targetDomain, userId, perCompetitorLimit, offset);
        const yourRefDomainsSet = new Set(yourRefDomains.map(r => r.domain));

        // Get all competitor referring domains
        let allCompetitorRefs: ReferringDomain[] = [];

        for (const comp of competitors) {
            const compRefs = await this.getReferringDomains(comp, userId, perCompetitorLimit, offset);
            allCompetitorRefs.push(...compRefs);
        }

        // Remove duplicates (same domain appearing multiple times)
        const uniqueDomains = Array.from(
            new Map(allCompetitorRefs.map(item => [item.domain, item])).values()
        );

        // Filter out domains that already link to you
        const gapDomains = uniqueDomains.filter(d => !yourRefDomainsSet.has(d.domain));

        // Convert to prospect format
        const prospects = gapDomains.map((d, index) => {
            const value: "high" | "medium" | "low" =
                d.domainAuthority > 70 ? "high" : d.domainAuthority > 50 ? "medium" : "low";
            return {
                id: `prospect-${Date.now()}-${index}`,
                domain: d.domain,
                url: `https://${d.domain}`,
                title: "",
                domainAuthority: d.domainAuthority || 0,
                relevanceScore: d.domainAuthority || 50,
                source: "competitors" as const,
                status: "new" as const,
                value,
                contact: null,
                notes: "",
                dateAdded: now,
                lastUpdated: now
            }
        });
        return prospects;
    }

    // Get project info for domain audit data
    async getProjectInfo(domain: string, userId: string): Promise<string> {
        const projects = await this.makeApiRequest(`/management/v1/projects`, {}, userId, 'projects', 'siteaudit', 1);

        const project = projects.find((p: any) => p.url === domain);
        return project.project_id;
    }

    private getGrade(score: number): string {
        if (score >= 90) return "A+";
        if (score >= 80) return "A";
        if (score >= 70) return "B";
        if (score >= 60) return "C";
        if (score >= 50) return "D";
        return "F";
    }

    private getScoreBreakdown(thematic: Record<string, any>) {
        return Object.entries(thematic).map(([key, obj]) => {
            const value = obj?.value ?? 0;
            return {
                name: capitalizeFirst(key),
                value,
                grade: this.getGrade(value),
            };
        });
    };


    // Get Website audit data specifically
    async getAuditData(domain: string, userId: string): Promise<any> {
        const params: Record<string, string> = {
            domain
        };

        const project_id = await this.getProjectInfo(domain, userId);

        const siteAuditData = await this.makeApiRequest(`/reports/v1/projects/${project_id}/siteaudit/info`, params, userId, 'seo_audits', 'siteaudit', 1);

        const qualityScore = siteAuditData.current_snapshot.quality?.value ?? 0;
        const qualityGrade = this.getGrade(qualityScore);
        const scoreBreakdown = this.getScoreBreakdown(siteAuditData?.current_snapshot?.thematicScores || {});
        const totalRecommendations = (siteAuditData.errors ?? 0) + (siteAuditData.warnings ?? 0) + (siteAuditData.notices ?? 0);

        return {
            domain,
            date: new Date().toLocaleDateString(),
            overallScore: { grade: qualityGrade, value: qualityScore },
            scores: scoreBreakdown,
            recommendations: totalRecommendations,
            onPageIssues: [
                {
                    issue: "Include a meta description tag",
                    category: "On-Page SEO",
                    priority: "High",
                    solution: "Add a meta description tag to your HTML that summarizes page content in 150-160 characters."
                },
                {
                    issue: "Add a favicon",
                    category: "Usability",
                    priority: "Low",
                    solution: "Create and add a favicon to improve brand recognition and user experience."
                }
            ],
            titleTag: {
                text: "Example Domain",
                length: 14,
                status: "error"
            },
            metaDescription: {
                status: "error",
                message: "Your page appears to be missing a meta description tag."
            },
            headerTags: {
                h1: { count: 1, status: "success" },
                h2: { count: 0, status: "error" },
                h3: { count: 0, status: "error" },
                h4: { count: 0, status: "error" },
                h5: { count: 0, status: "error" },
                h6: { count: 0, status: "error" }
            },
            performance: {
                grade: "A",
                pageContentLoaded: "0.1s",
                downloadSize: "0.0MB"
            },
            usability: {
                grade: "A+",
                viewport: true,
                tapTargets: true
            }
        }
        // const parsedData = this.transformGlobalKeywordData(csv Data);

        // const tableData = this.formatKeywordTableData(parsedData, userId)

    }

    // Transform domain overview response (CSV format)
    private transformDomainOverview(csvData: string): DomainOverview {
        const lines = csvData.trim().split('\n');
        if (lines.length < 2) {
            throw new SEMrushError('Invalid CSV response from SEMrush');
        }

        const headers = lines[0].split(';');
        const values = lines[1].split(';');

        // Create object from CSV data
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });

        return {
            domain: row['Domain'] || '',
            organicKeywords: parseInt(row['Organic Keywords'] || '0'),
            organicTraffic: parseInt(row['Organic Traffic'] || '0'),
            organicCost: parseFloat(row['Organic Cost'] || '0'),
            authorityScore: parseInt(row['Rank'] || '0'), // SEMrush rank as authority score
            backlinks: 0, // This endpoint doesn't return backlinks directly
        };
    }

    // Transform keyword data response (CSV format)
    private transformKeywordData(csvData: string, database?: string): KeywordData {
        const lines = csvData.trim().split('\n');
        if (lines.length < 2) {
            throw new SEMrushError('Invalid CSV response from SEMrush');
        }

        const headers = lines[0].split(';');
        const values = lines[1].split(';');

        // Create object from CSV data
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });

        const competition = parseFloat(row['Competition'] || '0');
        let competitionLevel: 'low' | 'medium' | 'high' = 'low';
        if (competition > 0.66) competitionLevel = 'high';
        else if (competition > 0.33) competitionLevel = 'medium';

        return {
            keyword: row['Keyword'] || '',
            searchVolume: parseInt(row['Search Volume'] || '0'),
            keywordDifficulty: parseInt(row['Keyword Difficulty Index'] || '0'),
            cpc: parseFloat(row['CPC'] || '0'),
            competition,
            competitionLevel,
            database: database || 'global',
        };
    }

    // Transform backlink overview data response (CSV format)
    private transformBacklinkOverview(csvData: string): BacklinkOverview {
        const lines = csvData.trim().split('\n');
        if (lines.length < 2) {
            throw new SEMrushError('Invalid CSV response from SEMrush');
        }

        const headers = lines[0].split(';');
        const values = lines[1].split(';');

        // Create object from CSV data
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });

        return {
            totalBacklinks: parseInt(row['total'] || '0'),
            totalReferringDomains: parseInt(row['domains_num'] || '0'),
            doFollowLinks: parseInt(row['follows_num'] || '0'),
            noFollowLinks: parseInt(row['nofollows_num'] || '0'),
            averageDomainAuthority: parseInt(row['ascore'] || '0'),
            toxicityScore: 0,
            newBacklinks: 0,
            lostBacklinks: 0
        };
    }

    private isTrue(val?: string): boolean {
        return val?.toLowerCase() === 'true';
    }
    // Transform backlinks data response (CSV format)
    private transformBacklinksData(csvData: string): Backlink[] {
        const lines = csvData.trim().split('\n');
        if (lines.length < 2) {
            throw new SEMrushError('Invalid CSV response from SEMrush');
        }

        const backlinks: Backlink[] = [];

        // Process all backlink entries (skip header)
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(';');
            if (parts.length >= 10) {
                const sourceUrl = parts[0] || '';
                let sourceDomain = '';
                if (sourceUrl) {
                    try {
                        const url = new URL(sourceUrl);
                        sourceDomain = url.hostname.replace(/^www\./, '');
                    } catch {
                        sourceDomain = '';
                    }
                }

                let status: 'broken' | 'new' | 'lost' | 'active' = 'active';
                if (parts[7] > '399') {
                    status = 'broken';
                } else if (this.isTrue(parts[8])) {
                    status = 'new';
                } else if (this.isTrue(parts[9])) {
                    status = 'lost';
                }
                // Detect backlink type
                let type: 'form' | 'frame' | 'image' | 'sitewide' | 'nofollow' | 'dofollow' | 'text' = 'text';
                if (this.isTrue(parts[3])) {
                    type = 'nofollow';
                } else if (this.isTrue(parts[3])) {
                    type = 'dofollow';
                } else if (this.isTrue(parts[10])) {
                    type = 'form';
                } else if (this.isTrue(parts[11])) {
                    type = 'frame';
                } else if (this.isTrue(parts[12])) {
                    type = 'image';
                } else if (this.isTrue(parts[13])) {
                    type = 'sitewide';
                }
                backlinks.push({
                    id: `${sourceDomain}-${sourceUrl.length}`,
                    sourceDomain,
                    sourceUrl,
                    targetUrl: parts[1] || '',
                    anchorText: parts[2] || '',
                    doFollow: !this.isTrue(parts[3]),
                    domainAuthority: 0,
                    pageAuthority: parseInt(parts[4] || '0', 10),
                    firstSeen: formatDate(parts[5]),
                    lastSeen: formatDate(parts[6]),
                    status,
                    type
                });
            }
        }
        return backlinks;
    }

    // Transform Referring domain data response (CSV format)
    private transformReferringDomainsData(csvData: string): ReferringDomain[] {
        const lines = csvData.trim().split('\n');
        if (lines.length < 2) {
            throw new SEMrushError('Invalid CSV response from SEMrush');
        }

        const ReferringDomains: ReferringDomain[] = [];
        // Process all backlink entries (skip header)
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(';');
            if (parts.length >= 7) {
                ReferringDomains.push({
                    // export interface ReferringDomain {
                    //     domain: string;
                    //     backlinksCount: number;
                    //     domainAuthority: number;
                    //     firstSeen: string;
                    //     lastSeen: string;
                    //     followLinks: number;
                    //     nofollowLinks: number;
                    // }
                    // domain_ascore,domain,backlinks_num,ip,country,first_seen,last_seen',
                    domain: parts[1] || '',
                    backlinksCount: parseInt(parts[2] || '0', 10),
                    domainAuthority: parseInt(parts[3] || '0', 10),
                    firstSeen: formatDate(parts[6]),
                    lastSeen: formatDate(parts[7]),
                    followLinks: 0,
                    nofollowLinks: 0,

                    // id: `${sourceDomain}-${sourceUrl.length}`,
                    // sourceDomain,
                    // sourceUrl,
                    // targetUrl: parts[1] || '',
                    // anchorText: parts[2] || '',
                    // doFollow: !this.isTrue(parts[3]),
                    // domainAuthority: 0,
                    // pageAuthority: parseInt(parts[4] || '0', 10),
                    // firstSeen: formatDate(parts[5]),
                    // lastSeen: formatDate(parts[6]),
                    // status,
                    // type
                });
            }
        }
        return ReferringDomains;
    }

    // Transform backlink competitor data response (CSV format)
    private transformBacklinkCometitorsData(csvData: string): BacklinkCometitorData[] {
        const lines = csvData.trim().split('\n');
        if (lines.length < 2) {
            throw new SEMrushError('Invalid CSV response from SEMrush');
        }

        const backlinkCompetitorsData: BacklinkCometitorData[] = [];

        // Process all backlink competitor entries (skip header)
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(';');
            if (parts.length >= 6) {
                const backlinkCometitorData: BacklinkCometitorData = {
                    domain: parts[1] || '',
                    totalBacklinks: parseInt(parts[5] || '0'),
                    totalReferringDomains: parseFloat(parts[4] || '0'),
                    similarity: parseFloat(parts[2] || '0'),
                    commonRefdomains: parseInt(parts[3] || '0'),
                    averageDomainAuthority: parseInt(parts[0] || '0'),
                };

                backlinkCompetitorsData.push(backlinkCometitorData);
            }
        }

        return backlinkCompetitorsData;
    }

    // Transform global keyword data (multiple databases format)
    private transformGlobalKeywordData(csvData: string): KeywordData {
        const lines = csvData.trim().split('\n');
        if (lines.length < 2) {
            throw new SEMrushError('Invalid CSV response from SEMrush');
        }

        let totalVolume = 0;
        let averageCpc = 0;
        let averageCompetition = 0;
        let averageDifficulty = 0;
        let validEntries = 0;
        const keyword = lines[1].split(';')[1] || ''; // Get keyword from first data line

        // Process all database entries (skip header)
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(';');
            if (parts.length >= 6) {
                const volume = parseInt(parts[2] || '0');
                const cpc = parseFloat(parts[3] || '0');
                const competition = parseFloat(parts[4] || '0');
                const difficulty = parseInt(parts[5] || '0');

                totalVolume += volume;
                averageCpc += cpc;
                averageCompetition += competition;
                averageDifficulty += difficulty;
                validEntries++;
            }
        }

        // Calculate averages
        if (validEntries > 0) {
            averageCpc /= validEntries;
            averageCompetition /= validEntries;
            averageDifficulty /= validEntries;
        }

        let competitionLevel: 'low' | 'medium' | 'high' = 'low';
        if (averageCompetition > 0.66) competitionLevel = 'high';
        else if (averageCompetition > 0.33) competitionLevel = 'medium';

        return {
            keyword,
            searchVolume: totalVolume,
            keywordDifficulty: Math.round(averageDifficulty),
            cpc: parseFloat(averageCpc.toFixed(2)),
            competition: parseFloat(averageCompetition.toFixed(2)),
            competitionLevel,
            database: 'global',
        };
    }

    // Transform related keywords response (CSV format)
    private transformRelatedKeywords(csvData: string, database?: string): RelatedKeyword[] {
        const lines = csvData.trim().split('\n');
        if (lines.length < 2) {
            throw new SEMrushError('Invalid CSV response from SEMrush');
        }

        const relatedKeywords: RelatedKeyword[] = [];

        // Process all related keyword entries (skip header)
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(';');
            if (parts.length >= 6) {
                const relatedKeyword: RelatedKeyword = {
                    keyword: parts[0] || '',
                    searchVolume: parseInt(parts[1] || '0'),
                    cpc: parseFloat(parts[2] || '0'),
                    competition: parseFloat(parts[3] || '0'),
                    keywordDifficulty: parseInt(parts[4] || '0'),
                    competitionLevel: 'low',
                    relevance: parseFloat(parts[5] || '0'),
                    database: database || 'global',
                };

                if (relatedKeyword.competition > 0.66) relatedKeyword.competitionLevel = 'high';
                else if (relatedKeyword.competition > 0.33) relatedKeyword.competitionLevel = 'medium';

                relatedKeywords.push(relatedKeyword);
            }
        }

        return relatedKeywords;
    }

    // Format Response data to Keyword Table
    private formatKeywordTableData(parsedData: KeywordData, userId: string, database?: string): KeywordTableData {
        return {
            user_id: userId,
            keyword: parsedData.keyword,
            search_volume: parsedData.searchVolume,
            keyword_difficulty: parsedData.keywordDifficulty,
            cpc: parsedData.cpc,
            competition: parsedData.competition,
            competition_level: parsedData.competitionLevel,
            database: parsedData.database
        };
    }

    // Format Keyword table data to Response 
    private formatKeywordResponse(data: KeywordTableData): KeywordData {
        return {
            keyword: data.keyword,
            searchVolume: data.search_volume,
            keywordDifficulty: data.keyword_difficulty,
            cpc: data.cpc,
            competition: data.competition,
            competitionLevel: data.competition_level,
            database: data.database
        };
    }
}

// Export singleton instance
export const semrushService = new SEMrushService(); 