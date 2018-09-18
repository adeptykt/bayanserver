'use strict';

module.exports = options => async hook => {
  if (!hook.data.password) hook.data.password = hook.params.user.password
  return Promise.resolve(hook);
};
