const nodemailer = require('nodemailer');

const sendOtp = async (email, otp) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'hariprasath.bc004@gmail.com',
            pass: 'byfe iwzf kkgv yyln', // You might need to set up App Password in Google
        },
    });

    const mailOptions = {
        from: 'hariprasath.bc004@gmail.com',
        to: email,
        subject: 'Your OTP Code',
        text: `Your OTP is: ${otp}`,
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Error sending OTP:', error);
        throw error;
    }
};

module.exports = { sendOtp };
