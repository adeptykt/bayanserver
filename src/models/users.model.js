// users-model.js - A users model
// 
// See http://mongoosejs.com/docs/models.html
// for more of what you can do here.
const schemas = require('../schemas');

module.exports = function (app) {
  const mongooseClient = app.get('mongooseClient');
  const users = new mongooseClient.Schema(schemas.user);

  return mongooseClient.model('users', users);
};
