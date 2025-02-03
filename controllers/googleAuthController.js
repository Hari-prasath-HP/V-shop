const User = require('../models/User');  // Assuming you have a User model

const googleAuthController = {
    googleLogin: async (req, res) => {
        console.log('Received request at /auth/google');
        const { id_token } = req.body;
        console.log('Received ID Token:', id_token);
        
        try {
          const ticket = await client.verifyIdToken({
            idToken: id_token,
            audience: process.env.GOOGLE_CLIENT_ID,
          });
      
          const payload = ticket.getPayload();
          console.log('Google User Info:', payload);
          res.json({ message: 'Login successful', user: payload });
        } catch (error) {
          console.error('Error verifying Google token:', error);
          res.status(400).json({ error: 'Google login failed' });
        }
      },
      
};

module.exports = googleAuthController;
