import { supabaseAdmin } from "@/config/supabaseAdmin";
import { sendVerificationEmail } from "@/lib/mailer/nodeMailer";
import { createUserWithEmailAndPassword, getUserByEmail } from "@/lib/userService";
import { ApiError } from "@/utils/ApiError";
import ApiResponse from "@/utils/ApiResponse";
import { asyncHandler } from "@/utils/asyncHandler";
import { generateOtp, getOtpExpiry, validateRequiredFields } from "@/utils/helpers";
import { Request, Response } from "express";

export const register = asyncHandler(async (req: Request, res: Response) => {
  validateRequiredFields(req.body, ['email', 'password']);

  const user = await createUserWithEmailAndPassword({ ...req.body, is_email_verified: false });

  const newUserVerifyCode = generateOtp();
  const otpExpiresAt = getOtpExpiry(10);

  const { error: insertError } = await supabaseAdmin
    .from("users")
    .update({
      email_verification_otp: newUserVerifyCode,
      otp_expires_at: otpExpiresAt,
    })
    .eq('id', user?.id);

  if (insertError) {
    throw new ApiError(500, insertError.message);
  }

  await sendVerificationEmail(user, newUserVerifyCode)

  res.status(201).json(new ApiResponse(201, user, 'Signup Successfully. Please check your email to confirm.'));
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  validateRequiredFields(req.body, ['otp']);

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('email', email)
    .eq('email_verification_otp', otp)
    .gte('otp_expires_at', new Date().toISOString())
    .maybeSingle();

  if (!data || error) {
    throw new ApiError(400, 'Invalid or expired OTP for email verification');
  }
  const { error: insertError } = await supabaseAdmin
    .from('users')
    .update({
      is_email_verified: true,
      email_verification_otp: null,
      otp_expires_at: null,
    })
    .eq('id', data.id);

  if (insertError) {
    throw new ApiError(500, 'Could not verify email');
  }

  res.status(200).json(new ApiResponse(200, undefined, 'Email verified successfully'));
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  validateRequiredFields(req.body, ['email', 'password']);

  const data = await getUserByEmail(email);

  if (!data) {
    throw new ApiError(400, 'User not found');
  }

  if (!data.is_email_verified) {
    throw new ApiError(400, 'Email is not verified');
  }

  const { data: { session }, error: userError } = await req.supabase.auth.signInWithPassword({
    email,
    password
  })

  const user = session?.user;
  const access_token = session?.access_token;

  if (userError) {
    throw new ApiError(401, userError.message || 'Invalid email or password');
  }
  res.cookie('refresh_token', session?.refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 7 * 1000, // 7 days
  });
  res.cookie('last_refresh', Date.now().toString(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 7 * 1000, // 7 days
  });

  res.status(200).json(new ApiResponse(200, { user, access_token }, 'Login successful'));
});
