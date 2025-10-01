import { Router } from "express";
import { getBacklinkOverviewAnalysis, getBacklinksAnalysis, getCompetitorsBacklinkAnalysis, getCountryKeywordAnalysis, getGlobalKeywordAnalysis, getRelatedKeywordAnalysis, getWebsiteAuditdAnalysis } from "@/controllers/semrush.controller";

const router = Router();

router.route('/keyword/related').get(getRelatedKeywordAnalysis);
router.route('/keyword/global').get(getGlobalKeywordAnalysis);
router.route('/keyword/country').get(getCountryKeywordAnalysis);
router.route('/audit/:domain').get(getWebsiteAuditdAnalysis);
router.route('/backlink/overview/:domain').get(getBacklinkOverviewAnalysis);
router.route('/backlink/competitors/:domain').get(getCompetitorsBacklinkAnalysis);
router.route('/backlinks/:domain').get(getBacklinksAnalysis);


export default router;