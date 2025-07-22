import { Router } from "express";
import { createTeam, deleteTeam, getTeamswithMembers, updateTeam } from "@/controllers/teams.controller";
import { getAccountTeamMembers } from "@/controllers/teamMembers.controller";

const router = Router();

router.route('/').get(getTeamswithMembers)
router.route('/:team_id/members').get(getAccountTeamMembers)

router.route('/').post(createTeam)
router.route('/:id').put(updateTeam)
router.route('/:id').delete(deleteTeam)


export default router;