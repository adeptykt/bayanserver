const { authenticate } = require('@feathersjs/authentication').hooks
const { restrictToOwner } = require('feathers-authentication-hooks')
const commonHooks = require('feathers-hooks-common')
const local = require('@feathersjs/authentication-local')
const logger = require('../../hooks/logger')
const orderCreateBefore = require('../../hooks/order-create-before')
const orderCreateAfter = require('../../hooks/order-create-after')
const hasPermissionBoolean = require('../../hooks/has-permission-boolean')

const restrict = [
  logger(),
  authenticate('jwt'),
  commonHooks.unless(
    hasPermissionBoolean('manageOrders'),
    restrictToOwner({
      idField: '_id',
      ownerField: 'userId'
    })
  )
]

function disable(context) {
  throw new Error('You do not have the permissions to access this.')
}

module.exports = {
  before: {
    all: [],
    find: [ disable ],
    get: [],
    create: [],
    update: [ disable ],
    patch: [ disable ],
    remove: [ disable ]
  },

  // all: [ local.hooks.protect('paymentId', 'idempotenceKey') ],
  after: {
    all: [],
    find: [],
    get: [],
    create: [ orderCreateAfter() ],
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
