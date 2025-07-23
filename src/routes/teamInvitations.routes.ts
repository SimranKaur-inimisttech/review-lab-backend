import { Router } from "express";
import { acceptTeamInvitation, createTeamInvitation, getPendingInvitations, getTeamInvitationByToken } from "@/controllers/teamInvitations.controller";

const router = Router();

router.route('/').post(createTeamInvitation);
router.route('/verify/:token').get(getTeamInvitationByToken);
router.route('/pending/:team_id').get(getPendingInvitations);
router.route('/:token/accept').post(acceptTeamInvitation);

export default router;