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
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>OTP Email</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 1px solid #eeeeee;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            color: #333333;
          }
          .content {
            padding: 20px 0;
            text-align: center;
          }
          .content h2 {
            font-size: 20px;
            color: #555555;
          }
          .otp {
            font-size: 32px;
            font-weight: bold;
            color: #007bff;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            padding-top: 20px;
            border-top: 1px solid #eeeeee;
            font-size: 14px;
            color: #777777;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to V-shop</h1>
          </div>
          <div class="content">
            <h2>Your One-Time Password (OTP) for Registration</h2>
            <div class="otp">${otp}</div>
            <p>Please use this OTP to complete your registration. This OTP is valid for a limited time.</p>
          </div>
          <div class="footer">
            <p>If you did not request this OTP, please ignore this email.</p>
            <p>&copy; 2023 V-shop. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
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
