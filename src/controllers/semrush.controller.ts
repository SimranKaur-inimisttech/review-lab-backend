import { semrushService } from "@/lib/semrushService";
import { ApiError } from "@/utils/ApiError";
import ApiResponse from "@/utils/ApiResponse";
import { asyncHandler } from "@/utils/asyncHandler";
import { Request, Response } from "express";
import { ParsedQs } from "qs";

interface KeywordQuery extends ParsedQs {
    keyword: string;
    database: string;
    limit?: string;
    offset?: string;
}
interface BacklinkQuery extends ParsedQs {
    limit?: string;
    offset?: string;
}

interface BacklinkGapQuery extends ParsedQs {
    targetDomain: string;
    competitors: string | string[];
    limit?: string;
    offset?: string;
}
export const getRelatedKeywordAnalysis = asyncHandler(async (req: Request, res: Response) => {
    const { keyword, database, limit = "20", offset = "0" } = req.query as KeywordQuery;

    if (!keyword) {
        throw new ApiError(400, `Keyword parameter is required`);
    }

    const userId = req.user!.id;
    const numericLimit = Math.min(parseInt(limit, 10) || 20, 100);
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
    const { onlyProfile } = req.query as { onlyProfile?: string };

    if (!domain) {
        throw new ApiError(400, `Domain parameter is required`);
    }
    const userId = req.user!.id;

    const data = await semrushService.getBacklinkOverview(domain, userId, onlyProfile === 'true');

    res.status(200).json(new ApiResponse(200, data, "Backlink data fetched successfully"));
});

export const getCompetitorsBacklinkAnalysis = asyncHandler(async (req: Request, res: Response) => {
    const { domain } = req.params;
    if (!domain) {
        throw new ApiError(400, `Domain parameter is required`);
    }
    const userId = req.user!.id;

    const data = await semrushService.getBacklinkCompetitorsData(domain, userId);

    res.status(200).json(new ApiResponse(200, data, "Backlink data fetched successfully"));
});

export const getBacklinksAnalysis = asyncHandler(async (req: Request, res: Response) => {
    const { domain } = req.params;
    if (!domain) {
        throw new ApiError(400, `Domain parameter is required`);
    }

    const { limit = "20", offset = "0" } = req.query as BacklinkQuery;

    const userId = req.user!.id;
    const numericLimit = Math.min(parseInt(limit, 10) || 20, 100);
    const numericOffset = parseInt(offset, 10) || 0;

    const data = await semrushService.getBacklinks(domain, userId, numericLimit,
        numericOffset);

    const totalAvailable = numericOffset + data.length + (data.length === numericLimit ? numericLimit : 0);

    res.status(200).json(new ApiResponse(200, {
        domain: domain.trim(),
        totalResults: data.length,
        totalAvailable,
        currentPage: {
            offset: numericOffset,
            limit: numericLimit,
            count: data.length
        },
        hasMore: data.length === numericLimit,
        backlinks: data
    }, "Backlink data fetched successfully"));
});

export const getBacklinkGapAnalysis = asyncHandler(async (req: Request, res: Response) => {
    const { targetDomain, competitors = [], limit = "20", offset = "0" } = req.query as BacklinkGapQuery;

    const competitorList = Array.isArray(competitors)
    ? competitors
    : competitors.split(",").map(c => c.trim());

    if (!targetDomain || !competitors?.length) {
        throw new ApiError(400, `Domain and competitors domain is required`);
    }

    const userId = req.user!.id;
    const numericLimit = Math.min(parseInt(limit, 10) || 20, 100);
    const numericOffset = parseInt(offset, 10) || 0;

    const data = await semrushService.getBacklinkGap(targetDomain, competitorList, userId, numericLimit, numericOffset);
    console.log("datata",data);

    const totalAvailable = numericOffset + data.length + (data.length === numericLimit ? numericLimit : 0);

    res.status(200).json(new ApiResponse(200, {
        domain: targetDomain.trim(),
        totalResults: data.length,
        totalAvailable,
        currentPage: {
            offset: numericOffset,
            limit: numericLimit,
            count: data.length
        },
        hasMore: data.length === numericLimit,
        prospects: data
    }, "Prospect data fetched successfully"));
});