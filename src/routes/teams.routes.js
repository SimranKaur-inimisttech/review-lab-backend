import { Router } from "express";
import { getTeams } from "../controllers/teams.controllers.js";

const router = Router();

router.route('/').get(getTeams)

export default router;