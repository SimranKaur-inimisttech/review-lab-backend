// import jwt from 'jsonwebtoken';
import { ApiError } from "@/utils/ApiError";
import { NextFunction, Request, Response } from "express";

const TEN_MINUTES = 10 * 60 * 1000;

export const refreshAccessToken = async (req: Request, res: Response, next: NextFunction) => {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const refreshToken = req.cookies?.refresh_token;
    const lastRefresh = Number(req.cookies?.last_refresh || '0');
    const now = Date.now();

    if (!accessToken || !refreshToken) {
        return next(); // Not authenticated, let auth middleware handle this
    }

    try {
        if (now - lastRefresh >= TEN_MINUTES) {
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
            res.cookie('refresh_token', data.session?.refresh_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: 'strict',
                maxAge: 60 * 60 * 24 * 7 * 1000, // 7 days
            });
            res.cookie('last_refresh', Date.now().toString(), {
                httpOnly: true,
                sameSite: 'strict',
                secure: process.env.NODE_ENV === "production",
                maxAge: 60 * 60 * 24 * 7 * 1000, // 7 days
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
