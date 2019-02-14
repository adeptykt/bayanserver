const { authenticate } = require('@feathersjs/authentication').hooks
const { restrictToOwner } = require('feathers-authentication-hooks')
const commonHooks = require('feathers-hooks-common')
const isEnabled = require('../../hooks/is-enabled')
const hasPermissionBoolean = require('../../hooks/has-permission-boolean')
const checkElcerts = require('../../hooks/check-elcerts')

const restrict = [
  authenticate('jwt'),
  isEnabled(),
  commonHooks.unless(
    hasPermissionBoolean('manageOperations'),
    restrictToOwner({
      idField: '_id',
      ownerField: 'userId'
    })
  ),
  checkElcerts
]

module.exports = {
  before: {
    all: [ authenticate('jwt') ],
    find: [ ...restrict ],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
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
