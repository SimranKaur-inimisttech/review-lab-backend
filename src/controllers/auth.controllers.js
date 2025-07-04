// import { supabase } from "../config/supabaseClient.js";
import { supabase } from "../config/supabaseAdmin.js";
import { sendVerificationEmail } from "../lib/mailer/nodeMailer.js";
import { ApiError } from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { generateOtp, getOtpExpiry } from "../utils/helpers.js";

export const register = asyncHandler(async (req, res) => {
  const { email, password, metadata } = req.body;

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      ...metadata || {},
      is_email_verified: false
    }
  });

  if (error) {
    throw new ApiError(error.status, error.message);
  }

  const newUserVerifyCode = generateOtp();
  const otpExpiresAt = getOtpExpiry(10);

  const { error: insertError } = await supabase
    .from("users")
    .update({
      email_verification_otp: newUserVerifyCode,
      otp_expires_at: otpExpiresAt,
    })
    .eq('id', data.user.id);

  if (insertError) {
    throw new ApiError(insertError.status, insertError.message);
  }

  await sendVerificationEmail(data.user, newUserVerifyCode)

  res.status(201).json(new ApiResponse(201, data.user, 'Signup Successfully. Please check your email to confirm.'));
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      ...metadata || {},
      is_email_verified: false
    }
  });

  if (error) {
    throw new ApiError(error.status, error.message);
  }

  const newUserVerifyCode = generateOtp();
  const otpExpiresAt = getOtpExpiry(10);

  const { error: insertError } = await supabase
    .from("users")
    .update({
      email_verification_otp: newUserVerifyCode,
      otp_expires_at: otpExpiresAt,
    })
    .eq('id', data.user.id);

  if (insertError) {
    throw new ApiError(insertError.status, insertError.message);
  }

  await sendVerificationEmail(data.user, newUserVerifyCode)

  res.status(201).json(new ApiResponse(201, data.user, 'Signup Successfully. Please check your email to confirm.'));
});
