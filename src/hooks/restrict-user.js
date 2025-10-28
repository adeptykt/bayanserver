const _ = require('lodash');

module.exports = function(options = {}) {
  return async function(hook) {

    const idField = options.idField || '_id'
    const roles = options.roles || ['admin']

    if (!hook.params.provider) { return hook; }

    const { user } = hook.params

    // For admin and superadmin allow everything
    if (!user) throw new Forbidden('restrictUser: You are not allowed to access this !user')


    if (!!roles.find(role => user.role === role)) { return hook }

    if (!hook.id) {
      // When requesting multiple, restrict the query to the user
      hook.params.query[idField] = user._id
    } else {
      // When acessing a single item, check first if the user is an owner
      const item = await hook.service.get(hook.id)

      if (item[idField].toString() !== user._id.toString()) {
        console.log('You are not allowed to access this != _id:', item[idField], user._id, typeof(item[idField]), typeof(user._id))
        throw new Forbidden('You are not allowed to access this != _id: ' + item[idField] + ' - ' + user._id)
      }
    }

    return hook

  }
};
