const mongoose = require('mongoose');

/**
 * Runs `work(session)` inside a MongoDB transaction, retrying on transient
 * errors (write conflicts). Throws whatever `work` throws; `work` signals an
 * expected business failure by throwing an HttpError.
 */
async function runInTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await work(session); });
    return result;
  } finally {
    await session.endSession();
  }
}

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

/** Sends an HttpError as JSON; returns false when `error` is not one. */
function sendHttpError(res, error) {
  if (!(error instanceof HttpError)) return false;
  res.status(error.status).json({ message: error.message, ...error.extra });
  return true;
}

module.exports = { runInTransaction, HttpError, sendHttpError };
