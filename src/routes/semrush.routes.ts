import { Router } from "express";
import { getBacklinkGapAnalysis, getBacklinkOverviewAnalysis, getBacklinksAnalysis, getCompetitorsBacklinkAnalysis, getCountryKeywordAnalysis, getGlobalKeywordAnalysis, getLocations, getPositionTrackingAnalysis, getRelatedKeywordAnalysis, getWebsiteAuditdAnalysis } from "@/controllers/semrush.controller";

const router = Router();

// Keyword
router.route('/keyword/related').get(getRelatedKeywordAnalysis);
router.route('/keyword/global').get(getGlobalKeywordAnalysis);
router.route('/keyword/country').get(getCountryKeywordAnalysis);
router.route('/tracking').get(getPositionTrackingAnalysis);
router.route('/locations').get(getLocations);

// Website Audit
router.route('/audit/:domain').get(getWebsiteAuditdAnalysis);

// Backlink
router.route('/backlink/overview/:domain').get(getBacklinkOverviewAnalysis);
router.route('/backlink/competitors/:domain').get(getCompetitorsBacklinkAnalysis);
router.route('/backlinks/:domain').get(getBacklinksAnalysis);
router.route('/backlink/gap').get(getBacklinkGapAnalysis);

export default router;