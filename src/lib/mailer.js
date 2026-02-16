import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false, // Allow self-signed certificates
  },
});

// Function to send verification email
export async function sendVerificationEmail(email, code) {
  const mailOptions = {
    from: `"Dengo" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Verify Your Email - Dengo",
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 32px auto; border-radius: 16px; box-shadow: 0 4px 24px rgba(34,197,94,0.08); background: #fff; border: 1px solid #e5e7eb; overflow: hidden;">
        <div style="background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%); padding: 24px 0; text-align: center;">
          <h2 style="color: #fff; font-size: 2rem; margin: 0; letter-spacing: 1px;">Verify Your Email</h2>
        </div>
        <div style="padding: 32px 24px 24px 24px;">
          <p style="font-size: 1.1rem; color: #222; text-align: center; margin-bottom: 24px;">
            Thank you for joining Dengo! Please use the code below to verify your email address:
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <span style="font-size: 2.2rem; font-weight: bold; color: #22c55e; background: #f0fdf4; padding: 16px 40px; border-radius: 8px; letter-spacing: 6px; display: inline-block; border: 2px dashed #22c55e;">
              ${code}
            </span>
          </div>
          <p style="text-align: center; font-size: 1rem; color: #666; margin-bottom: 0;">
            This code is valid for 10 minutes.<br>If you didn’t request this, you can ignore this email.
          </p>
        </div>
        <div style="background: #f0fdf4; padding: 16px 0; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 0.95rem; color: #16a34a; margin: 0;">
            &copy; ${new Date().getFullYear()} Dengo &mdash; Need help? <a href="mailto:Dengo@gmail.com" style="color: #16a34a; text-decoration: underline;">Contact Support</a>
          </p>
        </div>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Verification email sent:', info.response || info);
    return info;
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
}

// Function to send reset password email
export async function sendResetPasswordEmail(email, resetLink) {
  const mailOptions = {
    from: `"Dengo" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Reset Your Password - Dengo",
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 32px auto; border-radius: 16px; box-shadow: 0 4px 24px rgba(34,197,94,0.08); background: #fff; border: 1px solid #e5e7eb; overflow: hidden;">
        <div style="background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%); padding: 24px 0; text-align: center;">
          <h2 style="color: #fff; font-size: 2rem; margin: 0; letter-spacing: 1px;">Reset Your Password</h2>
        </div>
        <div style="padding: 32px 24px 24px 24px;">
          <p style="font-size: 1.1rem; color: #222; text-align: center; margin-bottom: 24px;">
            We received a request to reset your password. Please click the button below to reset your password:
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetLink}" style="font-size: 1.2rem; font-weight: bold; color: #fff; background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%); padding: 14px 36px; border-radius: 8px; text-decoration: none; display: inline-block; box-shadow: 0 2px 8px rgba(34,197,94,0.10);">
              Reset Password
            </a>
          </div>
          <p style="text-align: center; font-size: 1rem; color: #666; margin-bottom: 0;">
            If you didn’t request a password reset, please ignore this email.
          </p>
        </div>
        <div style="background: #f0fdf4; padding: 16px 0; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 0.95rem; color: #16a34a; margin: 0;">
            &copy; ${new Date().getFullYear()} Dengo &mdash; Need help? <a href="mailto:Dengo@gmail.com" style="color: #16a34a; text-decoration: underline;">Contact Support</a>
          </p>
        </div>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}

export default transporter;
