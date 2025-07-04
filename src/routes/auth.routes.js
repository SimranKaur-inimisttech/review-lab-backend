import { Router } from "express";
import { register, verifyEmail } from "../controllers/auth.controllers.js";

const router = Router();

router.route('/signup').post(register)
router.route('/verify-email').post(verifyEmail)

export default router;