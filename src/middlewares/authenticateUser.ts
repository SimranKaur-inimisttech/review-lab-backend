import { Request, Response, NextFunction } from "express";
import { ApiError } from "@/utils/ApiError";

export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new ApiError(401, 'Missing or invalid authorization header');
    }

    const token = authHeader.split(" ")[1];

    const { data: { user }, error } = await req.supabase.auth.getUser(token);

    if (error || !user) {
        throw new ApiError(401, 'Invalid or expired token', error);
    }

    req.user = user; // Add Supabase user to req object
    next();
};
