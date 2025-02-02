const nodemailer = require('nodemailer');

const sendOtp = async (email, otp) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'hariprasath.bc004@gmail.com',
            pass: 'byfe iwzf kkgv yyln', //app password 
        },
    });

    const mailOptions = {
        from: 'hariprasath.bc004@gmail.com',
        to: email,
        subject: 'Registration otp for V-shop',
        text: `Here is the one time password for the registration: ${otp}`,
      };
    
      try {
        await transporter.sendMail(mailOptions);
      } catch (error) {
        console.error('Error sending OTP:', error);
        throw error;
      }
    };
    
    module.exports = { sendOtp };
