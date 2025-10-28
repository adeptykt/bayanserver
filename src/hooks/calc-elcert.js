'use strict'

module.exports = function() {
  return function (hook) {
    let certificateId = hook.result.certificateId
    let canceledAt = hook.result.createdAt
    let cancelNumber = hook.result.docNumber
    let cancelStore = hook.result.store
    let cancelType = hook.result.docType
    hook.app.service('elcerts').get(certificateId).then(certificate => {
      hook.app.service('ecredemptions').Model.aggregate([
        { $match: { certificateId } },
        { $group: { _id: 0, sum: { $sum: '$sum' } } }
      ]).exec((error, results) => {
        if (results.length) {
          let result = results[0]
          let sum = Math.max(certificate.sum - result.sum, 0)
          let data = { sum }
          if (sum === 0) Object.assign(data, { canceled: true, canceledAt, cancelNumber, cancelStore, cancelType })
          hook.app.service('elcerts').patch(certificateId, data)
        }
        return Promise.resolve(hook)
      })
    })
  }
}
