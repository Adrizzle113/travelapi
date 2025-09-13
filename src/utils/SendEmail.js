import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "maliksabatali@gmail.com",
    pass: "tocy gmfn gnlp enah",
  },
  tls: {
    rejectUnauthorized: false // <- Ignore self-signed cert
  }
});

export const SendEmail = async (mailOptions) => {
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent:", info.response);
    return info;
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  }
};
