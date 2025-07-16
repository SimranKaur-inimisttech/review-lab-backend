import { Router } from "express";
import { createTeamInvitation } from "@/controllers/teamInvitations.controller";

const router = Router();

router.route('/').post(createTeamInvitation);

export default router;