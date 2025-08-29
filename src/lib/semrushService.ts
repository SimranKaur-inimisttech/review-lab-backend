import { supabaseAdmin } from '@/config/supabaseAdmin';
import { cacheService } from './cacheService';

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

            if (currentUsage + creditsRequired > limit) {
                throw new QuotaExceededError(
                    `${apiEndpoint} quota exceeded. Used: ${currentUsage}/${limit}`,
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
        reportType: string,
        params: Record<string, string>,
        userId: string,
        apiEndpoint: string,
        requestType: string,
        creditsRequired: number = 1,
    ): Promise<string> {

        // Only check quota if cache is empty
        // await this.checkQuota(userId, apiEndpoint, creditsRequired);

        // Make API request to SEMrush
        const url = new URL('/', this.baseUrl);
        url.searchParams.append('type', reportType);
        url.searchParams.append('key', this.apiKey);

        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.append(key, String(value));
            }
        });

        let lastError: Error = new Error("Unknown error");

        // for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        try {

            const response = await fetch(url.toString());

            if (!response.ok) {
                if (response.status === 429) {
                    const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
                    await this.logUsage(
                        userId, apiEndpoint, requestType, 'rate_limited', 0,
                        params.domain, params.phrase, `Rate limited, retry after ${retryAfter}s`
                    );
                    throw new RateLimitError(`Rate limited by SEMrush API`, retryAfter);
                }
                if (response.status === 402) {
                    await this.logUsage(
                        userId, apiEndpoint, requestType, 'quota_exceeded', 0,
                        params.domain, params.phrase, 'SEMrush API quota exceeded'
                    );
                    throw new QuotaExceededError('SEMrush API quota exceeded', apiEndpoint);
                }
                throw new SEMrushError(
                    `SEMrush API error: ${response.status} ${response.statusText}`,
                    response.status
                );
            }
            // Log successful API usage
            await this.logUsage(
                userId, apiEndpoint, requestType, 'success', creditsRequired,
                params.domain, params.phrase
            );
            const result = await response.text();

            return result; // SEMrush returns CSV text, not JSON
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            if (error instanceof RateLimitError || error instanceof QuotaExceededError) {
                throw error;
            }

            // if (attempt < this.maxRetries) {
            //     await new Promise(resolve => setTimeout(resolve, this.retryDelay * (attempt + 1)));
            // }
        }
        // }
        // Log failed API call
        await this.logUsage(
            userId, apiEndpoint, requestType, 'failed', 0,
            params.domain, params.phrase, lastError.message
        );

        throw new SEMrushError(
            `Failed to make request after ${this.maxRetries + 1} attempts: ${lastError.message}`,
            undefined,
            apiEndpoint,
            lastError
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
            phrase: keyword,
            export_columns: 'Ph,Nq,Cp,Co,Kd'
        };

        // Add database parameter only if specified
        if (database) {
            params.database = database;
        }

        // Check cache first
        const cachedData = await cacheService.get('keywords', keyword, database);
        if (cachedData && cachedData.search_volume && cachedData.keyword_difficulty && cachedData.cpc) {
            return this.formatKeywordResponse(cachedData)
        }

        const csvData = await this.makeApiRequest('phrase_this', params, userId, 'keyword_research', 'keyword_overview', 1);

        const parsedData = this.transformKeywordData(csvData, database);

        const tableData = this.formatKeywordTableData(parsedData, userId)

        // Store in cache
        await cacheService.set('keywords', tableData, 36);
        return this.transformKeywordData(csvData, database);
    }

    // Get global keyword data specifically (uses phrase_all endpoint)
    async getGlobalKeywordData(keyword: string, userId: string): Promise<KeywordData> {
        const params: Record<string, string> = {
            phrase: keyword,
            export_columns: 'Db,Ph,Nq,Cp,Co,Kd'
        };

        // Check cache first
        const cachedData = await cacheService.get('keywords', keyword, 'global');
        if (cachedData) {
            return this.formatKeywordResponse(cachedData)
        }

        // Use phrase_all for global data across all databases
        const csvData = await this.makeApiRequest('phrase_all', params, userId, 'keyword_research', 'keyword_research', 1);

        const parsedData = this.transformGlobalKeywordData(csvData);

        const tableData = this.formatKeywordTableData(parsedData, userId)

        // Store in cache
        await cacheService.set('keywords', tableData, 36);
        return parsedData;
    }

    // Get country-specific keyword data
    async getCountryKeywordData(keyword: string, userId: string, countryCode: string): Promise<KeywordData> {
        return this.getKeywordData(keyword, userId, countryCode);
    }

    /**
     * Fetch related keywords / keyword variations from SEMrush with pagination support.
     *
     * @param keyword       Main keyword to search variations for
     * @param userId        Current authenticated user ID (for quota logging)
     * @param database      SEMrush DB (e.g. "us"), omit or "global" for global
     * @param limit         Rows to return (1–100). Default 20.
     * @param offset        Zero-based row offset for pagination. Default 0.
     */
    async getRelatedKeywords(
        keyword: string,
        userId: string,
        database: string,
        limit: number = 20,
        offset: number = 0
    ): Promise<RelatedKeyword[]> {

        const params: Record<string, string> = {
            phrase: keyword,
            export_columns: 'Ph,Nq,Cp,Co,Kd,Rr',
            export_rows: limit.toString()
        };

        // Add offset for pagination when requested (>0)
        if (offset > 0) {
            params.export_offset = offset.toString();
        }

        // Add database parameter only if specified
        if (database && database !== 'global') {
            params.database = database;
        }

        // Check cache first
        const cachedData = await cacheService.get('keywords', keyword, database);
        if (!!cachedData?.related_keywords) {
            return cachedData?.related_keywords;
        }

        // const csvData = await this.makeApiRequest('phrase_related', params, userId, 'keyword_research', 'keyword_research', 1);

        // // check for Not found error message
        // if (csvData.includes('ERROR 50 :: NOTHING FOUND')) {
        //     console.warn(`No related keywords found for "${keyword}" in "${database || 'global'}"`);
        //     return [];
        // }

        // check for API LIMIT 
        // if (csvData.includes('ERROR 132 :: API UNITS BALANCE IS ZERO')) {
        const data = [{
            "keyword": "Popular Keywords",
            "searchVolume": 320,
            "keywordDifficulty": 0,
            "cpc": 1.67,
            "competition": 0.01,
            "competitionLevel": 'high',
            "database": "us",
            'relevance': 0
        }, {
            "keyword": "Popular Keywords",
            "searchVolume": 320,
            "keywordDifficulty": 0,
            "cpc": 1.67,
            "competition": 0.01,
            "competitionLevel": 'high',
            "database": "us",
            'relevance': 0
        }, {
            "keyword": "Popular Keywords",
            "searchVolume": 320,
            "keywordDifficulty": 0,
            "cpc": 1.67,
            "competition": 0.01,
            "competitionLevel": 'high',
            "database": "us",
            'relevance': 0
        }];
        // Store in cache
        await cacheService.set('keywords', { ...cachedData, keyword, database, related_keywords: data }, 36);
        return data;
        // }

        const parsedData = this.transformRelatedKeywords(csvData, database);

        // Store in cache
        await cacheService.set('keywords', { ...cachedData, keyword, database, related_keywords: parsedData }, 36);

        return parsedData
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

        const headers = lines[0].split(';');
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