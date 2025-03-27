const express = require("express");
const router = express.Router();
const User = require("../models/User");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const Otp = require('../models/renderotp');
const bcrypt = require("bcryptjs");
require('dotenv').config();
const otpGenerator = require("otp-generator");
const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS, 
    },
});
exports.getforgetpassword = (req, res) => {
    const error = req.query.error || null;
    res.render('user/forgetpassword', { error });
  };
  exports.postForgetPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.render("user/forgetpassword", { error: "User not found!" });
        }

        // Generate a 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000);
        console.log(otp);

        // Set OTP expiration (60 seconds from now)
        const otpExpires = new Date(Date.now() + 60 * 1000);

        // Save OTP in the Otp collection, including otpExpires
        const otpData = await Otp.create({ email, otp, otpExpires });

        // Email setup
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: "Password Reset OTP",
            text: `Your OTP for resetting your password is: ${otp}. This OTP is valid for 60 seconds.`,
            html: `
                <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto;">
                    <h2 style="color: #4A90E2;">Password Reset Request</h2>
                    <p>Hello,</p>
                    <p>You have requested to reset your password. Please use the following OTP to proceed:</p>
                    <p style="font-size: 24px; font-weight: bold; color: #4A90E2;">${otp}</p>
                    <p>This OTP is valid for <strong>60 seconds</strong>. Do not share it with anyone.</p>
                    <p>If you did not request this, please ignore this email.</p>
                    <p>Best regards,</p>
                    <p><strong>Your App Team</strong></p>
                    <hr style="border: 0; border-top: 1px solid #eee;">
                    <p style="font-size: 12px; color: #777;">This is an automated message. Please do not reply to this email.</p>
                </div>
            `,
        };

        await transporter.sendMail(mailOptions);

        res.render("user/forgetotpverify", { email, error: null });

    } catch (error) {
        console.error("Error in forget password:", error);
        res.render("user/forgetpassword", { error: "Something went wrong. Try again!" });
    }
};
exports.postVerifyOtp = async (req, res) => {
    const { email, otp } = req.body;

    try {
        // Find the OTP record in the database
        const otpRecord = await Otp.findOne({ email, otp });

        if (!otpRecord) {
            return res.status(400).json({ success: false, message: "Invalid OTP!" });
        }

        // If OTP is correct, render resetPassword.ejs
        return res.render("user/resetPassword", { email });

    } catch (error) {
        console.error("OTP Verification Error:", error);
        return res.status(500).json({ success: false, message: "Server error. Please try again." });
    }
};
exports.setNewPassword = async (req, res) => {
    try {
        const { email, newPassword } = req.body;

        if (!email || !newPassword) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }

        // Check if the user exists
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Compare new password with old password (if it exists)
        const isSamePassword = user.password 
            ? await bcrypt.compare(newPassword, user.password) 
            : false;

        if (isSamePassword) {
            return res.status(400).json({ success: false, message: "New password cannot be the same as the old password" });
        }

        // Hash the new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update password in the database
        user.password = hashedPassword;
        await user.save();

        res.json({ success: true, message: "Password updated successfully" });
    } catch (error) {
        console.error("Error updating password:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};


