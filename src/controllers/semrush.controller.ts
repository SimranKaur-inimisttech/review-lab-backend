import { syncUserWithHubspot } from "@/lib/hubspotIntegration";
import { semrushService } from "@/lib/semrushService";
import { getUserByEmail } from "@/lib/userService";
import { ApiError } from "@/utils/ApiError";
import ApiResponse from "@/utils/ApiResponse";
import { asyncHandler } from "@/utils/asyncHandler";
import { validateRequiredFields } from "@/utils/helpers";
import { Request, Response } from "express";

export const getKeywordAnalysis = asyncHandler(async (req: Request, res: Response) => {

        const { keyword, database } = req.query;
        const userId = req.user.id;
        const teamId = req.user.teamId;

        const data = await semrushService.getKeywordData(keyword, userId, teamId, database);
        res.json(data);
   

    // 2. Fetch from Semrush API
    const semrushUrl = `https://api.semrush.com/?type=phrase_this&key=${SEMRUSH_API_KEY}&phrase=${encodeURIComponent(
        keyword
    )}`;

    // validateRequiredFields(req.body, ['email']);

    // const { email } = req.body;

    // const user = await getUserByEmail(email);

    // const { data, success, error } = await syncUserWithHubspot(user);

    // if (!success) {
    //     throw new ApiError(500, `HubSpot sync failed`);
    // }

    // res.status(200).json(new ApiResponse(200, data, "User synced to HubSpot"));
});
