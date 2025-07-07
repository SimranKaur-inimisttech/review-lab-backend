import { Router } from "express";
import { login, register, verifyEmail } from "../controllers/auth.controllers.js";

const router = Router();

router.route('/signup').post(register)
router.route('/verify-email').post(verifyEmail)
router.route('/login').post(login)

export default router;