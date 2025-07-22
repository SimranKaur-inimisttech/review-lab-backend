import { Application, Router } from "express";
import { authenticateUser } from "./authenticateUser";

export const protectRoutes = (app: Application, path: string, router: Router) => {
  app.use(path, authenticateUser, router);
};