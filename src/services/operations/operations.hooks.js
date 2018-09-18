const { authenticate } = require('@feathersjs/authentication').hooks
const { restrictToOwner } = require('feathers-authentication-hooks')
const commonHooks = require('feathers-hooks-common')
const addId = require('../../hooks/add-id')
const isEnabled = require('../../hooks/is-enabled')
const calcScores = require('../../hooks/calc-scores')
const hasPermissionBoolean = require('../../hooks/has-permission-boolean')

const restrict = [
  authenticate('jwt'),
  isEnabled(),
  commonHooks.unless(
    hasPermissionBoolean('manageOperations'),
    restrictToOwner({
      idField: '_id',
      ownerField: 'userId'
    })
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
