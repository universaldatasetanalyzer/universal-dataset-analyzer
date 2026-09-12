const rateLimit = require('express-rate-limit');

function userOrIpKey(req) {
  return req.user?.id || req.ip;
}

const expensive = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: message },
});

const rateLimits = {
  chat: expensive(15 * 60 * 1000, 30, 'Too many AI chat requests. Please try again later.'),
  insights: expensive(15 * 60 * 1000, 10, 'Too many insight generation requests. Please try again later.'),
  reports: expensive(60 * 60 * 1000, 10, 'Too many report generation requests. Please try again later.'),
  invites: expensive(60 * 60 * 1000, 10, 'Too many invitations. Please try again later.'),
  checkout: expensive(15 * 60 * 1000, 10, 'Too many checkout sessions. Please try again later.'),
  passwordReset: rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many password reset requests. Please try again later.' },
  }),
  uploads: expensive(60 * 60 * 1000, 10, 'Upload limit reached. Please try again later.'),
};

module.exports = rateLimits;
