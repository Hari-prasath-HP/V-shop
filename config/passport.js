const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User"); 

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_REDIRECT_URI,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ email: profile.emails[0].value });

        if (!user) {
          // Create a new user if not found
          user = new User({
            username: profile.displayName,
            email: profile.emails[0].value,
            phone: "",
            password: null,
          });
          await user.save();
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
    done(null, user.id|| user.googleId); 
  });
  
  passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findOne({ _id: id }) || await User.findOne({ googleId: id });
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});
