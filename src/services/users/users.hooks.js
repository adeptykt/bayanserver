const { authenticate } = require('@feathersjs/authentication').hooks
const commonHooks = require('feathers-hooks-common')
const { restrictToOwner } = require('feathers-authentication-hooks')
const { hashPassword } = require('@feathersjs/authentication-local').hooks
const logger = require('../../hooks/logger')
const idToObjectId = require('../../hooks/idToObjectId')
const _ = require('lodash')

const isEnabled = require('../../hooks/is-enabled')
const hasPermissionBoolean = require('../../hooks/has-permission-boolean')
const checkPassword = require('../../hooks/check-password')
const setDefaultRole = require('../../hooks/set-default-role')
const setFirstUserToRole = require('../../hooks/set-first-user-to-role')

const restrict = [
  authenticate('jwt'),
  isEnabled(),
  commonHooks.unless(
    hasPermissionBoolean('manageUsers'),
    restrictToOwner({
      idField: '_id',
      ownerField: '_id'
    })
  )
]

const schema = {
  include: [{
    service: 'roles',
    nameAs: 'access',
    parentField: 'role',
    childField: 'role'
  }],
}

const serializeSchema = {
  computed: {
    permissions: (item, hook) => _.get(item, 'access.permissions'),
  },
  exclude: ['access', '_include']
}

module.exports = {
  before: {
    all: [],
    find: [...restrict, idToObjectId()],
    get: [...restrict],
    create: [
      authenticate('jwt'),
      hashPassword(),
      setDefaultRole(),
      setFirstUserToRole({role: 'admin'}),
    ],
    update: [ ...restrict, hashPassword(), checkPassword() ],
    patch: [  ...restrict, hashPassword() ],
    // create: [ authenticate('jwt'), hashPassword({passwordField: 'code'}) ],
    // update: [ ...restrict, hashPassword({passwordField: 'code'}) ],
    // patch: [  ...restrict, hashPassword({passwordField: 'code'}) ],
    remove: [ ...restrict ]
  },

  after: {
    all: [
      commonHooks.when(
        hook => hook.params.provider,
        commonHooks.discard('password')
      )
    ],
    find: [
      commonHooks.populate({ schema }),
      commonHooks.serialize(serializeSchema),
    ],
    get: [
      commonHooks.populate({ schema }),
      commonHooks.serialize(serializeSchema),
    ],
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
