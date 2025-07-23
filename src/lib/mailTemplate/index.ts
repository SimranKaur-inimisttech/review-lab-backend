const templates = {
  verifyEmail: (otp: string) => `
      <html>
        <body>
          <h1>Verify Email</h1>
          <p>Please verify your email by entering the code below: <b>${otp}</b></p>
        </body>
      </html>
    `,
  invitationEmail: ({ role, inviteUrl, invitation_type }: Record<string, any>) => `
      <html>
        <body>
        ${invitation_type === 'project'
      ? (`<h1>You're Invited to Join one of our teams to Collaborate on a Project in OG01</h1>
              <p>You've been invited you to join a project workspace on the OG01 platform as a <strong>${role}</strong>.</p>`)
      : (`<h1>You're Invited to Join OG01</h1>
               <p>You've been invited to join the OG01 platform with <strong>${role}</strong> access.</p>`)}       
          <p>Click the link below to get started:</p>
          <h4><a href="${inviteUrl}">${inviteUrl}</a></h4>
          <p>This invitation expires in 7 days.</p>
          <p>If you did not expect this invitation, you can safely ignore this email.</p>
          <br />
          <p>Best regards,<br />The OG01 Team</p>
        </body>
      </html>
  `,
};

type EmailTemplateType = "verifyemail" | 'invitationemail';

export const mailTemplate = (template: EmailTemplateType, { otp, role, inviteUrl, invitation_type }: Record<string, any>) => {
  switch (template) {
    case "verifyemail":
      return templates.verifyEmail(otp);
    case "invitationemail":
      return templates.invitationEmail({ role, inviteUrl, invitation_type });
    default:
      throw new Error("Invalid email template type");
  }
};
