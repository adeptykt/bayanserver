'use strict';
const util = require('util') 

module.exports = options => async hook => {
  //console.log('___debug___: ' + util.inspect(hook.params, false, null))
  return Promise.resolve(hook);
};
