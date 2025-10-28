'use strict';
const util = require('util')

module.exports = function() {
  return function(hook) {
    let userId = hook.result.userId
    let currentDate = new Date()
    // console.log('calc-scores');
    // hook.app.service('operations').Model.aggregate([{$match: {userId, status: 1}},{$group: {_id: 0, scores: { $sum: '$scores'}}}]).exec(function(error, results) {
    //   if (results.length) hook.app.service('users').patch(userId, {scores: Math.round((results[0].scores)*100)/100})
    //   return Promise.resolve(hook);
    // })
    hook.app.service('operations').Model.aggregate([
      // { $match: { userId, status: 1, $or: [ { validAt: { $exists: true, $lt: currentDate } }, { validAt: { $exists: false } } ] } },
      { $match: { userId, status: 1 } },
      {
        $project: {
          createdAt: 1,
          kind: { $ifNull: ['$kind', 0] },
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
      {
        $project: {
          kind: 1,
          amount: { $add: [ "$accrual", "$scores" ] }
        }
      },
      { $group: { _id: '$kind', amount: { $sum: '$amount' } } }
    ]).exec((error, results) => {
      const listScores = []
      let scores = 0
      if (results.length) {
        results.forEach(res => {
          const amount = Math.round(res.amount*100)/100
          listScores.push({ kind: res._id, scores: amount })
          scores += amount
        })
      }
      hook.app.service('users').patch(userId, { scores, listScores })
      return Promise.resolve(hook);
    })
  };
};
