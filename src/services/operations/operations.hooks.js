const { authenticate } = require('@feathersjs/authentication').hooks
const restrictUser = require('../../hooks/restrict-user')
// const { restrictToOwner } = require('feathers-authentication-hooks')
const commonHooks = require('feathers-hooks-common')
const addId = require('../../hooks/add-id')
const isEnabled = require('../../hooks/is-enabled')
const calcScores = require('../../hooks/calc-scores')
const logger = require('../../hooks/logger')
const hasPermissionBoolean = require('../../hooks/has-permission-boolean')

const restrict = [
  logger(),
  authenticate('jwt'),
  isEnabled(),
  commonHooks.unless(
    hasPermissionBoolean('manageOperations'),
    restrictUser({ idField: 'userId' })
    // restrictToOwner({
    //   idField: '_id',
    //   ownerField: 'userId'
    // })
  )
]

module.exports = {
  before: {
    all: [ authenticate('jwt') ],
    find: [ ...restrict ],
    get: [],
    create: [ isEnabled() ],
    update: [],
    patch: [],
    remove: []
  },

  after: {
    all: [],
    find: [],
    get: [ addId() ],
    create: [ calcScores() ],
    update: [ addId(), calcScores() ],
    patch: [ addId(), calcScores() ],
    remove: [ calcScores(), hook => { hook.result = {data: 'Remove succesful'} } ]
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
