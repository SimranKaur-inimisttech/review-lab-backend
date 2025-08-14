import { Router } from "express";
import { getKeywordAnalysis } from "@/controllers/semrush.controller";

const router = Router();

router.route('/keyword/related').get(getKeywordAnalysis);

export default router;