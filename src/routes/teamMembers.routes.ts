import { Router } from "express";
import { inviteTeamMember } from "@/controllers/teamMembers.controller";

const router = Router();

router.route('/invite').post(inviteTeamMember)

export default router;