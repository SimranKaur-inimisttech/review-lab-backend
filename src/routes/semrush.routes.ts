import { Router } from "express";
import { getBacklinkOverviewAnalysis, getCountryKeywordAnalysis, getGlobalKeywordAnalysis, getRelatedKeywordAnalysis, getWebsiteAuditdAnalysis } from "@/controllers/semrush.controller";

const router = Router();

router.route('/keyword/related').get(getRelatedKeywordAnalysis);
router.route('/keyword/global').get(getGlobalKeywordAnalysis);
router.route('/keyword/country').get(getCountryKeywordAnalysis);
router.route('/audit/:domain').get(getWebsiteAuditdAnalysis);
router.route('/backlink/:domain').get(getBacklinkOverviewAnalysis);

export default router;