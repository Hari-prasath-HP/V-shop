const express = require("express");
const router = express.Router();
const User = require("../models/User"); // Adjust the path to your User model
const nodemailer = require("nodemailer");
const crypto = require("crypto");
require('dotenv').config();
const otpGenerator = require("otp-generator");

// Configure Nodemailer for sending emails
const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
        user: process.env.EMAIL_USER, // Your email from environment variables
        pass: process.env.EMAIL_PASS, // Your app password
    },
});
exports.getforgetpassword = (req, res) => {
    const error = req.query.error || null; // Fetch error from query params if available
    res.render('user/forgetpassword', { error });
  };

  // ✅ Handle Forget Password (Generate OTP & Send Email)
exports.postForgetPassword = async (req, res) => {
    try {
        const { email } = req.body;
        console.log(req.body)
        // Check if user exists
        const user = await User.findOne({ email });
        if (!user) {
            return res.render("user/forgetpassword", { error: "User not found!" });
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000);

        // Save OTP to user model (optional: You can also store in session)
        user.otp = otp;
        user.otpExpires = Date.now() + 6000; // OTP expires in 5 minutes
        await user.save();

        // Send OTP email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: "Password Reset OTP",
            text: `Your OTP for resetting your password is: ${otp}. This OTP is valid for 60 seconds.`,
        };

        await transporter.sendMail(mailOptions);

        res.render("user/forgetotpverify", { email, error: null }); // Redirect to OTP verification page

    } catch (error) {
        console.error("Error in forget password:", error);
        res.render("user/forgetpassword", { error: "Something went wrong. Try again!" });
    }
};
exports.postVerifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;
        console.log(req.body)
        // Find user by email
        const user = await User.findOne({ email });

        if (!user) {
            return res.render("user/forgetotpverify", { email, error: "User not found!" });
        }
        // Check if OTP matches
        if (user.otp !== otp) {
            return res.render("user/forgetotpverify", { email, error: "Invalid OTP. Please try again!" });
        }

        // OTP is correct → Redirect to reset password page
        res.render("user/resetPassword", { email, error: null });

    } catch (error) {
        console.error("Error verifying OTP:", error);
        res.render("user/verifyOtp", { email, error: "Something went wrong! Try again." });
    }
};
