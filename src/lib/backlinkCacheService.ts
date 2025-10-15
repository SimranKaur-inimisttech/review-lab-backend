import { supabaseAdmin } from "@/config/supabaseAdmin";
import { ApiError } from "@/utils/ApiError";

// services/cacheService.ts
export const backlinkCacheService = {
    async get(table: string, domain: string, data_type: string, database?: string) {
        
        const { data: cache, error: cacheError } = await supabaseAdmin
            .from(table)
            .select('data, expires_at')
            .eq('domain', domain)
            .eq('data_type', data_type)
            .eq('database_region', database)
            .maybeSingle();
            
        if (cacheError && cacheError.code !== "PGRST116") {
            throw new ApiError(500, "Database error");
        }

        if (cache && new Date(cache.expires_at) > new Date()) {
            return cache;
        }
    },

    async set({
        table,
        user_id,    
        domain,
        dataType,
        databaseRegion,
        data,
        ttlHours = 24
    }: {
        table: string;
        user_id: string;
        domain: string;
        dataType: string;
        databaseRegion?: string;
        data: any;
        ttlHours?: number;
    }) {
        console.log("data to be cached--------------------->>>", data)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + ttlHours);
        const { error } = await supabaseAdmin.from(table)
            .upsert(
                [{  
                    user_id,
                    domain,
                    data_type: dataType,
                    database_region: databaseRegion,
                    data,
                    expires_at: expiresAt
                }],
                { onConflict: 'user_id,domain,data_type,database_region', ignoreDuplicates: false }
            );
        console.log("cache error--------------------->>>", error)
    }
};
