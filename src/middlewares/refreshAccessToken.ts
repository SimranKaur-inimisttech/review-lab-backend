// import jwt from 'jsonwebtoken';
import { ApiError } from "@/utils/ApiError";
import { NextFunction, Request, Response } from "express";

const TEN_MINUTES = 5 * 60 * 1000;

export const refreshAccessToken = async (req: Request, res: Response, next: NextFunction) => {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const refreshToken = req.cookies?.refresh_token;
    const lastRefresh = Number(req.cookies?.last_refresh || '0');
    const now = Date.now();
    console.log("refesh token===================>", refreshToken,accessToken)
    if (!accessToken || !refreshToken) {
        return next(); // Not authenticated, let auth middleware handle this
    }

    try {
        if (now - lastRefresh >= TEN_MINUTES) {
            console.log("working refeh token =====>>>>>>>>>>>")
            const { data, error } = await req.supabase.auth.refreshSession({ refresh_token: refreshToken });
            if (error || !data?.session) {
                throw new ApiError(401, 'Session expired, please log in again.');
            }

            // Send new access token in header for this request
            req.headers.authorization = `Bearer ${data.session.access_token}`;
            // ✅ Store new token for future middlewares
            res.locals.accessToken = data.session.access_token;
            res.locals.user = data.session.user;

            // Refresh cookie for next time
            res.cookie('refresh_token', data.session.refresh_token, {
                httpOnly: true,
                secure: true,
                sameSite: 'strict',
                maxAge: 60 * 60 * 24 * 7 // 7 days
            });

            // send new access token in response header
            res.setHeader('x-access-token', data.session.access_token);
            req.user = data.session.user;
        }
        return next();
    } catch (err) {
        return next(err);
    }
};
