const { getUserPlan, isPaidPlan } = require('../services/plan');

// Runs BEFORE multer, so a blocked user never even gets a file written to disk.
async function requirePaidPlan(req, res, next) {
  try {
    const plan = await getUserPlan(req.user.id);
    if (!isPaidPlan(plan)) {
      return res.status(402).json({
        error: 'Uploading your own datasets requires a Pro subscription. Try every feature for free on the demo dataset, or upgrade to unlock uploads.',
        code: 'UPGRADE_REQUIRED',
      });
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requirePaidPlan };
