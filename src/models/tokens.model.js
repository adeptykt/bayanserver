// tokens-model.js - A mongoose model
// 
// See http://mongoosejs.com/docs/models.html
// for more of what you can do here.
module.exports = function (app) {
  const mongooseClient = app.get('mongooseClient');
  const { Schema } = mongooseClient;
  const tokens = new Schema({
    userId: { type: global.mongoose.Schema.ObjectId, ref: 'user', required: true },
    code: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now, expires: 30*60 },
  });

  return mongooseClient.model('tokens', tokens);
};
