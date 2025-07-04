import nodemailer from "nodemailer";
import { mailTemplate } from "../mailTemplate/index.js";
import { ApiError } from "../../utils/ApiError.js";

// Create a nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SENDER_HOST,
  secure: false,
  port: process.env.EMAIL_SENDER_PORT,
  auth: {
    user: process.env.EMAIL_SENDER,
    pass: process.env.EMAIL_SENDER_PASSWORD,
  },
});

// Function to send verification email
export async function sendVerificationEmail(user, otp) {
  const htmlTemplate = mailTemplate("verifyemail", otp);
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

export async function sendForgotPasswordEmail(user, newPassword) {
  const htmlTemplate = mailTemplate("forgotpassword", newPassword);
  const mailOptions = {
    from: process.env.EMAIL_SENDER,
    to: user.email,
    subject: "Forgot password email",
    html: htmlTemplate,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Forgot Password Email sent to" + user.email);
  } catch (error) {
    throw new Error("Failed to send Otp to forgot password. Please try again.");
  }
}

export async function sendChangePasswordEmail(user, createToken) {
  const htmlTemplate = mailTemplate("changepassword", createToken);
  const mailOptions = {
    from: process.env.EMAIL_SENDER,
    to: user.email,
    subject: "Change password email",
    html: htmlTemplate,
  };

  try {
    const mailerResponse = await transporter.sendMail(mailOptions);
    console.log("Forgot Password Email sent to" + user.email);
    return mailerResponse;
  } catch (error) {
    throw error;
  }
}

export async function sendChangePasswordAlertEmail(user, newPassword = null) {
  const htmlTemplate = mailTemplate("changepasswordalert", "");
  const mailOptions = {
    from: process.env.EMAIL_SENDER,
    to: user.email,
    subject: "Change password alert",
    html: htmlTemplate,
  };

  try {
    const mailerResponse = await transporter.sendMail(mailOptions);
    console.log("Forgot Password Email sent to" + user.email);
    return mailerResponse;
  } catch (error) {
    throw error;
  }
}
