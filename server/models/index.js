const User = require('./User');
const Booking = require('./Booking');
const Transaction = require('./Transaction');
const Payment = require('./Payment');
const Notification = require('./Notification');
const Message = require('./Message');
const Review = require('./Review');
const EmailJob = require('./EmailJob');
const TeacherApplication = require('./TeacherApplication');
const TeacherEmailCheck = require('./TeacherEmailCheck');
const Payout = require('./Payout');

const all = [User, Booking, Transaction, Payment, Notification, Message, Review, EmailJob, TeacherApplication, TeacherEmailCheck, Payout];

/** Brings collection indexes in line with the schemas (drops stale ones, e.g. the old unique Transaction.booking). */
const syncIndexes = () => Promise.all(all.map((model) => model.syncIndexes()));

module.exports = { User, Booking, Transaction, Payment, Notification, Message, Review, EmailJob, TeacherApplication, TeacherEmailCheck, Payout, syncIndexes };
