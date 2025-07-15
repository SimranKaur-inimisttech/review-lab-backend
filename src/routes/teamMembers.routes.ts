import { Router } from "express";
import { inviteTeamMember } from "../controllers/teamMembers.controller.js";

const router = Router();

router.route('/invite').post(inviteTeamMember)

export default router;