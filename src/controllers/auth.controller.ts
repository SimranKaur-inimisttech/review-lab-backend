import { supabaseAdmin } from "@/config/supabaseAdmin";
import { sendVerificationEmail } from "@/lib/mailer/nodeMailer";
import { ApiError } from "@/utils/ApiError";
import ApiResponse from "@/utils/ApiResponse";
import { asyncHandler } from "@/utils/asyncHandler";
import { generateOtp, getOtpExpiry, validateRequiredFields } from "@/utils/helpers";
import { Request, Response } from "express";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, metadata } = req.body;
  validateRequiredFields(req.body, ['email', 'password']);

  const { data: { user }, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      ...metadata || {},
      is_email_verified: false
    }
  });

  if (error || !user) {
    throw new ApiError(error?.status, error?.message);
  }

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

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id , email , is_email_verified')
    .eq('email', email)
    .maybeSingle();
  if (!data || error) {
    throw new ApiError(400, 'User not found');
  }
  if (!data.is_email_verified) {
    throw new ApiError(400, 'Email is not verified');
  }

  const { data: user, error: userError } = await req.supabase.auth.signInWithPassword({
    email,
    password
  })

  if (userError) {
    throw new ApiError(401, userError.message || 'Invalid email or password');
  }

  res.status(200).json(new ApiResponse(200, user, 'Login successful'));
});
