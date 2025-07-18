import { Router } from "express";
import { createTeam, getTeamswithMembers, updateTeam } from "@/controllers/teams.controller";

const router = Router();

router.route('/').get(getTeamswithMembers)
router.route('/').post(createTeam)
router.route('/').put(updateTeam)

export default router;