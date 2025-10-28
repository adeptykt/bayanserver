const { authenticate } = require('@feathersjs/authentication').hooks
const calcCertificate = require('../../hooks/calc-elcert')

module.exports = {
  before: {
    all: [ authenticate('jwt') ],
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
    create: [ calcCertificate() ],
    update: [ calcCertificate() ],
    patch: [ calcCertificate() ],
    remove: [ calcCertificate(), hook => { hook.result = {data: 'Remove succesful'} }
    ]
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
