import { Router } from "express";
import { syncHubspotContact } from "@/controllers/hubspot.controller";

const router = Router();

router.route('/hubspot-sync').post(syncHubspotContact);

export default router;