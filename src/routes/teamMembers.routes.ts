import { Router } from "express";
import { inviteTeamMember, removeTeamMember } from "@/controllers/teamMembers.controller";

const router = Router();

router.route('/invite').post(inviteTeamMember)
router.route('/:teamId/:userId/remove').patch(removeTeamMember)


export default router;