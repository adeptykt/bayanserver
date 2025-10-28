const { authenticate } = require('@feathersjs/authentication').hooks
const hasPermissionBoolean = require('../../hooks/has-permission-boolean')
const commonHooks = require('feathers-hooks-common')
// const { restrictToOwner } = require('feathers-authentication-hooks')
const restrictUser = require('../../hooks/restrict-user')

const restrict = [
  authenticate('jwt'),
  commonHooks.unless(
    hasPermissionBoolean('manageNotifications'),
    restrictUser({ idField: 'userId' })
  )
]

module.exports = {
  before: {
    all: [ ...restrict ],
    find: [],
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
