// certificates-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html
// for more of what you can do here.
const autoIncrement = require('mongoose-auto-increment')

const statuses = [
  'valid',
  'used',
  'blocked'
]

module.exports = function (app) {
  const mongooseClient = app.get('mongooseClient')
  const { Schema } = mongooseClient;

  autoIncrement.initialize(mongooseClient.connection)

  const elcerts = new Schema({
    number: { type: Number, unique: true, required: true },
    status: { type: String, required: true, default: 'valid', enum: statuses },
    price: { type: Number },
    sum: { type: Number },
    sold: { type: Boolean },
    soldAt: { type: Date },
    cancelNumber: { type: String, required: false },
    cancelStore: { type: String },
    cancelType: { type: String },
    canceled: { type: Boolean },
    canceledAt: { type: Date },
    blocked: { type: Boolean },
    reason: { type: String },
    email: { type: String },
    userId: { type: global.mongoose.Schema.ObjectId },
    orderId: { type: global.mongoose.Schema.ObjectId },
    recipient: { type: String },
    createdAt: { type: Date, default: Date.now }
  })

  elcerts.plugin(autoIncrement.plugin, { model: 'elcerts', field: 'number' })

  return mongooseClient.model('elcerts', elcerts)
}
