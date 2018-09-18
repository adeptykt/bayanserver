'use strict';
const util = require('util')

module.exports = function() {
  return function(hook) {
    let userId = hook.result.userId
    let currentDate = new Date()
    // hook.app.service('operations').Model.aggregate([{$match: {userId, status: 1}},{$group: {_id: 0, scores: { $sum: '$scores'}}}]).exec(function(error, results) {
    //   if (results.length) hook.app.service('users').patch(userId, {scores: Math.round((results[0].scores)*100)/100})
    //   return Promise.resolve(hook);
    // })
    hook.app.service('operations').Model.aggregate([
      { $match: { userId, status: 1, $or: [ { validAt: { $exists: true, $lt: currentDate } }, { validAt: { $exists: false } } ] } },
      { $group: { _id: 0, scores: { $sum: '$scores' }, accrual: { $sum: '$accrual' } } }
    ]).exec((error, results) => {
      if (results.length) hook.app.service('users').patch(userId, { scores: Math.round((results[0].scores+results[0].accrual)*100)/100 })
      else hook.app.service('users').patch(userId, { scores: 0 })
      return Promise.resolve(hook);
    })
  };
};
