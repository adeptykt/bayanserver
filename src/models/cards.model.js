// cards-model.js - A mongoose model
// 
// See http://mongoosejs.com/docs/models.html
// for more of what you can do here.
module.exports = function (app) {
  const mongooseClient = app.get('mongooseClient');
  const { Schema } = mongooseClient;
  const cards = new Schema({
    code: { type: String, unique: true, required: true },
    // userId: { type: global.mongoose.Schema.ObjectId, ref: 'user', required: true },
    userId: { type: String, required: true },
    blocked: { type: Boolean },
    createdAt: { type: Date, default: Date.now }
  });

  return mongooseClient.model('cards', cards);
};
