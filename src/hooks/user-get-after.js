const { get, set } = require('lodash')

module.exports = (options = {}) => async hook => {
  if (hook.data) {
    const { _id } = hook.result
    const currentDate = new Date()
    var scores = 0

    console.log('user:', hook.result);

    try {
      var results = await hook.app.service('operations').Model.aggregate([
        { $match: { objectId: _id, status: 1 } },
        {
          $project: {
            createdAt: 1,
            scores: 1,
            accrual: {
              $cond: {
                if: { $lte: [ { $ifNull: ["$validAt", currentDate] }, currentDate ] },
                then: { $ifNull: ["$accrual", 0] },
                else: 0
              }
            }
          }
        },
        { $group: { _id: 0, scores: { $sum: '$scores' }, accrual: { $sum: '$accrual' } } }
      ])
      // if: { $or: [ { validAt: { $exists: true, $lt: currentDate } }, { validAt: { $exists: false } } ] },
      // results.forEach(res => {
      //   console.log('' + res.createdAt + ': ' + res.scores + ' - ' + res.accrual);
      // })
      if (results.length) scores = Math.round((results[0].scores+results[0].accrual)*100)/100
      console.log('calc scores: ', scores)
      set(hook.result, 'scores', scores)
    } catch(error) {
      console.log('calc error:', error);
    }

    Promise.resolve(hook)
  }
}
