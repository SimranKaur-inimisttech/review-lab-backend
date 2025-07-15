import { Router } from "express";
import { createTeam, getTeamswithMembers } from "../controllers/teams.controller.js";

const router = Router();

router.route('/').get(getTeamswithMembers)
router.route('/').post(createTeam)

export default router;