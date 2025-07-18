import { Router } from "express";
import { acceptTeamInvitation, createTeamInvitation, getTeamInvitationByToken } from "@/controllers/teamInvitations.controller";

const router = Router();

router.route('/').post(createTeamInvitation);
router.route('/:token').get(getTeamInvitationByToken);
router.route('/:token/accept').post(acceptTeamInvitation);

export default router;