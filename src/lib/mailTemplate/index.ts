const templates = {
  forgotPassword: (otp) => `
      <html>
        <body>
          <h1>Password Reset</h1>
          <p>We received the reset password request. Please reset your password by entering the code below: <b>${otp}</b></p>
        </body>
      </html>
    `,
  verifyEmail: (otp) => `
      <html>
        <body>
          <h1>Verify Email</h1>
          <p>Please verify your email by entering the code below: <b>${otp}</b></p>
        </body>
      </html>
    `,
  changePassword: (token) => `
    <html>
      <body>
        <h1>Change Password Reset Request</h1>
        <p>Change Password token is here you can use this for change new password</p>
        <h4>${token}</h4>
        <p>If you did not request this, please ignore this email.</p>
      </body>
    </html>
  `,
  changePasswordAlert: (forgotUrl, extrargs = "") => `
    <html>
      <body>
        <h1>You have change your Password</h1>
        <p>Change Password successfully!</p>
        <p>If you did not request this, please change password!. Through forgot password</p>
        <a href="${forgotUrl}">${forgotUrl}</h4>
      </body>
    </html>
  `,
  // Add more templates as needed
};

export const mailTemplate = (template, args = "") => {
  const forgotUrl = `${process.env.APP_DOMAIN}/forgotpassword`;
  switch (template) {
    case "forgotpassword":
      return templates.forgotPassword(args);
    case "verifyemail":
      return templates.verifyEmail(args);
    case "changepassword":
      return templates.changePassword(args);
    case "changepasswordalert":
      return templates.changePasswordAlert(forgotUrl, args);
    default:
      throw new Error("Invalid email template type");
  }
};
