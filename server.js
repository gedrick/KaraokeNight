const express = require('express')
const session = require('express-session')
const MongoStore = require('connect-mongo')(session)
const passport = require('passport')
const SpotifyStrategy = require('passport-spotify').Strategy
const bodyParser = require('body-parser')

const isProd = process.env.NODE_ENV === 'production'

let settings
if (isProd) {
  // settings = require('./server/settings.prod')
} else {
  settings = require('./server/config')
}
const host = process.env.HOST || 'http://localhost:8080'

// Set up Mongo.
const mongoose = require('mongoose')
mongoose.Promise = Promise
require('./server/db')(mongoose)

/**
 * Setup for Login with spotify.
 * Most of this is setting up `express-sessions` to store data in a
 * Mongo database.
 */
const server = express()
server.use(bodyParser.json())
server.use(bodyParser.urlencoded({
  extended: true
}))
server.use(session({
  secret: settings.login.sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: new MongoStore(settings.mongo)
}))
if (isProd) {
  server.use(express.static('./dist'))
} else {
  server.use(express.static('./public'))
}
server.use(passport.initialize())
server.use(passport.session())

/**
 * Set up Passport.
 * This is spotify specific. Different services require their own strategies.
 * Go here to find one for the service you want: http://www.passportjs.org/packages/
 */
passport.use(new SpotifyStrategy({
  clientID: settings.spotify.clientId,
  clientSecret: settings.spotify.secret,
  callbackURL: settings.login.callback,
  scope: settings.spotify.scopes
}, (accessToken, refreshToken, profile, done) => {
  const profileData = {
    accessToken,
    refreshToken,
    profile
  }
  return done(null, profileData)
}))

/**
 * serializeUser determines which data of the user object should be stored in the session
 */
passport.serializeUser(function (user, done) {
  // Only store the user id.
  // Whatever is passed as the second param is stored in req.session.passport.user.
  done(null, user)
})

/**
 * The first argument of deserializeUser corresponds to the key of the user
 * object that was given to the done function. Typically this users the user
 * ID to match a record in a User database. User.findById does just this.
 */
passport.deserializeUser(function (user, done) {
  // // Retrieve user by stored user id.
  // User.findById(id, (err, user) => {
  //   if (err) {
  //     console.log('deserializeUser error:', err)
  //   }
  //   done(null, user)
  // })
  console.log(user)

  done(null, user)
})

// Set up routes which are caught from the requests/callback at Login.vue and after
// signing into spotify.
server.get('/auth/spotify', passport.authenticate('spotify'))
server.get('/auth/callback', passport.authenticate('spotify', {
  failureRedirect: '/'
}), (req, res) => {
  res.redirect(`${host}/`)
})
server.get('/logout', (req, res) => {
  req.logout()
  res.redirect(`${host}/#/`)
})

// Start the server.
const port = process.env.PORT || 3000
server.listen(port, () => {
  console.log(`server operating on port ${port}`)
})
