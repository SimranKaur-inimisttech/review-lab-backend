import { semrushService } from "@/lib/semrushService";
import { ApiError } from "@/utils/ApiError";
import ApiResponse from "@/utils/ApiResponse";
import { asyncHandler } from "@/utils/asyncHandler";
import { Request, Response } from "express";
import { ParsedQs } from "qs";

interface KeywordQuery extends ParsedQs {
    keyword: string;
    database?: string;
    limit?: string;
    offset?: string;
}

export const getRelatedKeywordAnalysis = asyncHandler(async (req: Request, res: Response) => {
    const { keyword, database, limit = "30", offset = "0" } = req.query as KeywordQuery;

    if (!keyword) {
        throw new ApiError(400, `Keyword parameter is required`);
    }

    const userId = req.user!.id;
    const numericLimit = Math.min(parseInt(limit, 10) || 30, 100);
    const numericOffset = parseInt(offset, 10) || 0;

    const related = await semrushService.getRelatedKeywords(
        keyword,
        userId,
        database,
        numericLimit,
        numericOffset
    );

    const totalAvailable = numericOffset + related.length + (related.length === numericLimit ? numericLimit : 0);

    res.status(200).json(new ApiResponse(200, {
        keyword: keyword.trim(),
        database: database || 'global',
        totalResults: related.length,
        totalAvailable,
        currentPage: {
            offset: numericOffset,
            limit: numericLimit,
            count: related.length
        },
        hasMore: related.length === numericLimit,
        relatedKeywords: related
    }, "Related Keyword Data fetched successfully"));
});

export const getGlobalKeywordAnalysis = asyncHandler(async (req: Request, res: Response) => {
    const { keyword } = req.query as KeywordQuery;

    if (!keyword) {
        throw new ApiError(400, `Keyword parameter is required`);
    }

    const userId = req.user!.id;

    const data = await semrushService.getGlobalKeywordData(keyword, userId);

    res.status(200).json(new ApiResponse(200, data, "Global Keyword Data fetched successfully"));
});

export const getCountryKeywordAnalysis = asyncHandler(async (req: Request, res: Response) => {
    const { keyword, database } = req.query as KeywordQuery;

    if (!keyword) {
        throw new ApiError(400, `Keyword parameter is required`);
    }

    const userId = req.user!.id;

    const data = await semrushService.getCountryKeywordData(
        keyword,
        userId,
        database as string
    );

    res.status(200).json(new ApiResponse(200, data, "Country Keyword Data fetched successfully"));
});

export const getWebsiteAuditdAnalysis = asyncHandler(async (req: Request, res: Response) => {
    const { domain } = req.params;
    if (!domain) {
        throw new ApiError(400, `Domain parameter is required`);
    }
    const userId = req.user!.id;

    const data = await semrushService.getAuditData(domain, userId);

    res.status(200).json(new ApiResponse(200, data, "Wbsite audit data fetched successfully"));
});

export const getBacklinkOverviewAnalysis = asyncHandler(async (req: Request, res: Response) => {
    const { domain } = req.params;
    if (!domain) {
        throw new ApiError(400, `Domain parameter is required`);
    }
    const userId = req.user!.id;

    const data = await semrushService.getBacklinkOverview(domain, userId);

    res.status(200).json(new ApiResponse(200, data, "Backlink data fetched successfully"));
});