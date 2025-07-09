import { Router } from "express";
import { getTeamswithMembers } from "../controllers/teams.controllers.js";

const router = Router();

router.route('/').get(getTeamswithMembers)

export default router;