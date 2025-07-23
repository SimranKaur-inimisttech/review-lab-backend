import nodemailer from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";
import { mailTemplate } from "../mailTemplate";
import { ApiError } from "@/utils/ApiError";
import type { User } from '@supabase/supabase-js';

// Create a nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SENDER_HOST,
  secure: false,
  port: Number(process.env.EMAIL_SENDER_PORT),
  auth: {
    user: process.env.EMAIL_SENDER,
    pass: process.env.EMAIL_SENDER_PASSWORD,
  },
} as SMTPTransport.Options);

// Function to send verification email
export async function sendVerificationEmail(user: User, otp: string) {
  const htmlTemplate = mailTemplate("verifyemail", { otp });
  const mailOptions = {
    from: process.env.EMAIL_SENDER,
    to: user.email,
    subject: "Verify your email address",
    html: htmlTemplate,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Verification email sent to " + user.email);
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw new ApiError(500, 'Failed to send Otp to verify email. Please try again.')
  }
}

// Function to send verification email
export async function sendInvitationEmail({ email, token, role, invitation_type }: Record<string, any>) {

  let subject: string;
  let htmlTemplate: string;

  const inviteUrl = `${process.env.BASE_URL}/join-account/${token}`;

  if (invitation_type === 'project') {
    subject = "You're invited to collaborate on a Project";
    htmlTemplate = mailTemplate("invitationemail", { email, role, inviteUrl, invitation_type });
  } else {
    subject = "You're invited to join OG01 (Account Management)";
    htmlTemplate = mailTemplate("invitationemail", { email, role, inviteUrl, invitation_type });
  }

  const mailOptions = {
    from: process.env.EMAIL_SENDER,
    to: email,
    subject,
    html: htmlTemplate
  };

  try {
    await transporter.sendMail(mailOptions);

  } catch (error) {
    throw new ApiError(500, 'Failed to send invitation email. Please try again.')
  }
}
