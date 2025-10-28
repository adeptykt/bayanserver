// orders-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html
// for more of what you can do here.
const autoIncrement = require('mongoose-auto-increment')
const statuses = [
  'pending', // платеж создан, но не завершен
  'waiting_for_capture', // платеж выполнен и ожидает действий
  'succeeded', // платеж успешно завершен
  'canceled', // платеж отменен
  'expired' // Истек срок ожидания ввода данных
]

module.exports = function (app) {
  const mongooseClient = app.get('mongooseClient');
  const { Schema } = mongooseClient;

  autoIncrement.initialize(mongooseClient.connection)

  const orders = new Schema({
    userId: { type: global.mongoose.Schema.ObjectId },
    // userId: { type: String, required: true },
    status: { type: String, required: true, default: 'pending', enum: statuses },
    price: { type: Number, required: true },
    total: { type: Number, required: true },
    recipient: { type: String, required: true },
    email: { type: String, required: true },
    number: { type: Number, required: true },
    paymentId: { type: String },
    idempotenceKey: { type: String },
    url: { type: String },
    createdAt: { type: Date, default: Date.now }
  });

  orders.plugin(autoIncrement.plugin, { model: 'orders', field: 'number' })

  return mongooseClient.model('orders', orders);
};
