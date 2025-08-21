import { supabaseAdmin } from "@/config/supabaseAdmin";
import { ApiError } from "@/utils/ApiError";

// services/cacheService.ts
export const cacheService = {
    async get(table: string, keyword: string, database: string) {
        const { data: cache, error: cacheError } = await supabaseAdmin
            .from(table)
            .select('user_id,keyword,search_volume,keyword_difficulty,cpc,competition,competition_level,database,expires_at')
            .eq('keyword', keyword)
            .eq('database', database)
            .maybeSingle();
        console.log("data=====================>", cache, keyword, database)
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
        const { error } = await supabaseAdmin.from(table).upsert({
            ...data,
            expires_at: expiresAt
        });
        console.log("cache error--------------------->>>", error)
    }
};
