const { authenticate } = require('@feathersjs/authentication').hooks
// const { restrictToOwner } = require('feathers-authentication-hooks')
const restrictUser = require('../../hooks/restrict-user')
const commonHooks = require('feathers-hooks-common')
const isEnabled = require('../../hooks/is-enabled')
const hasPermissionBoolean = require('../../hooks/has-permission-boolean')
const checkElcerts = require('../../hooks/check-elcerts')

const restrict = [
  authenticate('jwt'),
  isEnabled(),
  commonHooks.unless(
    hasPermissionBoolean('manageOperations'),
    restrictUser({ idField: 'userId' })
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
