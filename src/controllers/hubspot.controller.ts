import { syncUserWithHubspot } from "@/lib/hubspotIntegration";
import { getUserByEmail } from "@/lib/userService";
import { ApiError } from "@/utils/ApiError";
import ApiResponse from "@/utils/ApiResponse";
import { asyncHandler } from "@/utils/asyncHandler";
import { validateRequiredFields } from "@/utils/helpers";
import { Request, Response } from "express";

export const syncHubspotContact = asyncHandler(async (req: Request, res: Response) => {
    validateRequiredFields(req.body, ['email']);

    const { email } = req.body;

    const user = await getUserByEmail(email);

    const { data, success, error } = await syncUserWithHubspot(user);

    if (!success) {
        throw new ApiError(500, `HubSpot sync failed`);
    }

    res.status(200).json(new ApiResponse(200, data, "User synced to HubSpot"));
});
