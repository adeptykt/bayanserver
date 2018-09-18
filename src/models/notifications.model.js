// notifications-model.js - A mongoose model
// 
// See http://mongoosejs.com/docs/models.html
// for more of what you can do here.
module.exports = function (app) {
  const mongooseClient = app.get('mongooseClient');
  const { Schema } = mongooseClient;
  const notifications = new Schema({
    userId: { type: global.mongoose.Schema.ObjectId, ref: 'user', required: true },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  })

  return mongooseClient.model('notifications', notifications)
}
