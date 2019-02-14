// roles-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html
// for more of what you can do here.

const validatePattern = require('../utils/validate-pattern');

const sitePermissions = [
  'delete',
  'create',
  'update',
  'read',
  'manageUsers',
  'manageRoles',
  'manageSettings',
  'manageOperations'
]

module.exports = function (app) {
  const mongooseClient = app.get('mongooseClient');
  const roles = {
    role: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      validate: validatePattern('isTitle')
    },
    permissions: [{
      type: String,
      enum: sitePermissions
    }],
    createdAt: {
      type: Date,
      'default': Date.now
    },
    updatedAt: {
      type: Date,
      'default': Date.now
    }
  }

  return mongooseClient.model('roles', roles);
};
