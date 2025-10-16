import { supabaseAdmin } from "@/config/supabaseAdmin";
import { ApiError } from "@/utils/ApiError";

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

    async set(table: string, data: any, cacheTtlHours: number = 24) {

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + cacheTtlHours);

        const { error } = await supabaseAdmin.from(table)
            .upsert(
                [{ ...data, expires_at: expiresAt }],
                { onConflict: 'user_id,domain,data_type,database_region', ignoreDuplicates: false }
            );
    }
};
