import { Application, Router } from "express";
import { authenticateUser } from "./authenticateUser";
import { refreshAccessToken } from "./refreshAccessToken";

export const protectRoutes = (app: Application, path: string, router: Router) => {
  app.use(path, refreshAccessToken, authenticateUser, router);
};