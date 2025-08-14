import { supabaseAdmin } from "@/config/supabaseAdmin";
import { ApiError } from "@/utils/ApiError";

// services/cacheService.ts
export const cacheService = {
    async get(table: string, keyword: string) {
        const { data: cache, error: cacheError } = await supabaseAdmin
            .from(table)
            .select('*')
            .eq('keyword', keyword)
            .maybeSingle();

        if (cacheError && cacheError.code !== "PGRST116") {
            throw new ApiError(500, "Database error");
        }
        if (cache && new Date(cache.expires_at) > new Date()) {
            return cache.data;
        }
    },
    async set(table: string, keyword: string, value: any, cacheTtlHours: number = 24) {

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + cacheTtlHours);
        await supabaseAdmin.from(table).upsert({
            keyword,
            data: value,
            expires_at: expiresAt
        });
    }
};
