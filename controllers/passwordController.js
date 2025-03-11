const express = require("express");
const router = express.Router();
const User = require("../models/User");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
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
        console.log(req.body)
        const user = await User.findOne({ email });
        if (!user) {
            return res.render("user/forgetpassword", { error: "User not found!" });
        }
        const otp = Math.floor(100000 + Math.random() * 900000);
        console.log(otp)
        user.otp = otp;
        user.otpExpires = Date.now() + 6000; 
        await user.save();
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: "Password Reset OTP",
            text: `Your OTP for resetting your password is: ${otp}. This OTP is valid for 60 seconds.`,
        };

        await transporter.sendMail(mailOptions);

        res.render("user/forgetotpverify", { email, error: null });

    } catch (error) {
        console.error("Error in forget password:", error);
        res.render("user/forgetpassword", { error: "Something went wrong. Try again!" });
    }
};
exports.postVerifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;
        console.log(req.body)
        const user = await User.findOne({ email });
        if (!user) {
            return res.render("user/forgetotpverify", { email, error: "User not found!" });
        }
        if (user.otp !== otp) {
            return res.render("user/forgetotpverify", { email, error: "Invalid OTP. Please try again!" });
        }
        res.render("user/resetPassword", { email, error: null });
    } catch (error) {
        console.error("Error verifying OTP:", error);
        res.render("user/verifyOtp", { email, error: "Something went wrong! Try again." });
    }
};
