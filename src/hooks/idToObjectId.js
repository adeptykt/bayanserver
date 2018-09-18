module.exports = function idToObjectId(options = {}) { // eslint-disable-line no-unused-vars
  return function (hook) {
    if (hook.params.query._id && hook.params.query._id.$in) {
      let ids = hook.params.query._id.$in
      let newids = []
      if (typeof ids === 'object') {
        for (var key in ids) newids.push(global.mongoose.Types.ObjectId(ids[key]))
        hook.params.query._id.$in = newids
      }
    }
  }
}

