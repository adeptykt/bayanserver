// codes-model.js - A mongoose model
// 
// See http://mongoosejs.com/docs/models.html
// for more of what you can do here.
module.exports = function (app) {
  const mongooseClient = app.get('mongooseClient');
  const { Schema } = mongooseClient;
  const codes = new Schema({
    phone: { type: String, required: true, unique: true },
    code: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now, expires: 60 }
  });

  return mongooseClient.model('codes', codes);
};
