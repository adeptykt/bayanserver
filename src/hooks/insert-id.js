'use strict';

const util = require('util') 

module.exports = function() {
  return function(hook) {
    // console.log('auth: ' + util.inspect(hook.params, false, null)) 
    hook.result.id = hook.params.user._id
    return Promise.resolve(hook);
  };
};
