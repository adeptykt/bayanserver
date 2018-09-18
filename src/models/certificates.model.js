// certificates-model.js - A mongoose model
// 
// See http://mongoosejs.com/docs/models.html
// for more of what you can do here.
module.exports = function (app) {
  const mongooseClient = app.get('mongooseClient')
  const { Schema } = mongooseClient;
  const certificates = new Schema({
    number: { type: Number, unique: true, required: true },
    productId: { type: String, required: true },
    price: { type: Number },
    sum: { type: Number },
    store: { type: String, required: true },
    saleNumber: { type: String, required: false },
    saleStore: { type: String },
    saleType: { type: String },
    sold: { type: Boolean },
    soldAt: { type: Date },
    cancelNumber: { type: String, required: false },
    cancelStore: { type: String },
    cancelType: { type: String },
    canceled: { type: Boolean },
    canceledAt: { type: Date },
    blocked: { type: Boolean },
    reason: { type: String },
    createdAt: { type: Date, default: Date.now }
  })

  return mongooseClient.model('certificates', certificates)
}
