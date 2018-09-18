const { authenticate } = require('@feathersjs/authentication').hooks
const hasPermission = require('../../hooks/has-permission')
const isEnabled = require('../../hooks/is-enabled')

module.exports = {
  before: {
    all: [ 
      authenticate('jwt'),
      isEnabled(),
    ],
    find: [],
    get: [],
    create: [
      hasPermission('manageRoles')
    ],
    update: [
      hasPermission('manageRoles')
    ],
    patch: [
      hasPermission('manageRoles')
    ],
    remove: [
      hasPermission('manageRoles')
    ]
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  },

  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  }
}
