// operations-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html
// for more of what you can do here.

const types = [
  0, // неопределено
  1, // оплата
  2, // списание бонусов
  3, // начисление бонусов
  4, // бонусы за вступление
]
  // 'accrual', // начисление бонусов
  // 'payment', // оплата
  // 'entry', // бонусы за вступление

const statuses = [
  0, // операция не выполнена
  1, // операция выполнена
  2, // операция отменена
]

module.exports = function (app) {
  const mongooseClient = app.get('mongooseClient');
  const { Schema } = mongooseClient;
  const operations = new Schema({
    // objectId: { type: global.mongoose.Schema.ObjectId, ref: 'user', required: true },
    objectId: { type: global.mongoose.Schema.ObjectId, required: true },
    userId: { type: String, required: true },
    type: { type: Number, required: true, enum: types },
    status: { type: Number, required: true, default: 1, enum: statuses },
    code: { type: String, required: false },
    total: { type: Number, required: false },
    scores: { type: Number, required: false },
    cash: { type: Number, required: false },
    cert: { type: Number, required: false },
    accrual: { type: Number, required: false },
    invoiceNumber: { type: String, required: false },
    store: { type: String, required: false },
    createdAt: { type: Date, default: Date.now },
    validAt: { type: Date },
    expiredAt: { type: Date },
    expired: { type: Boolean }
  });

  return mongooseClient.model('operations', operations);
};
