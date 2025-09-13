import { forAdminTemplate } from "./emailTemplates/ForAdmin.js";
import { forUserTemplate } from "./emailTemplates/ForUser.js";
import { otpTemplate } from "./emailTemplates/OTPmail.js";


export const mailOptionsForUser = async (userData) => {
  const forUser_Template = await forUserTemplate(userData);
  const mailOptionsForUser = {
    from: "maliksabatali@gmail.com",
    to: userData.email,
    subject: "Account Status - BookByAgent",
    html: forUser_Template,
  };
  return mailOptionsForUser;
};

export const mailOptionsForAdmin = async (userData) => {
  const forAdmin_Template = await forAdminTemplate(userData);
  const mailOptionsForAdmin = {
    from: "maliksabatali@gmail.com",
    to: "maliksabatali@gmail.com", // Admin email
    subject: "New User Registration - BookByAgent",
    html: forAdmin_Template,
  };
  return mailOptionsForAdmin;
};

export const mailOptionsForOTP = async (otp, to, userData) => {
  const otp_Template = await otpTemplate(userData, otp);
  const mailOptionsForOTP = {
    from: "maliksabatali@gmail.com",
    to: to,
    subject: "Hello from bookbyagent 🚀",
    html: otp_Template,
  };
  return mailOptionsForOTP;
};

export const mailOptionsForApproval = async (userData) => {
  const mailOptionsForApproval = {
    from: "maliksabatali@gmail.com",
    to: userData.email,
    subject: "Account Approved - BookByAgent 🎉",
    text: `Congratulations ${userData.first_name}! Your account has been approved. You can now login to access your dashboard.`,
  };
  return mailOptionsForApproval;
};