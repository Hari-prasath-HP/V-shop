require('dotenv').config();
const nodemailer = require('nodemailer');

const sendOtp = async (email, otp) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // Securely using environment variables
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Registration OTP for V-shop',
    text: `Here is your one-time password for registration: ${otp}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('OTP sent successfully to', email);
  } catch (error) {
    console.error('Error sending OTP:', error);
    throw error;
  }
};

module.exports = { sendOtp };
