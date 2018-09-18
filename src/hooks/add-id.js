'use strict';

const util = require('util') 
// Use this hook to manipulate incoming or outgoing data.
// For more information on hooks see: http://docs.feathersjs.com/api/hooks.html

module.exports = function() {
  return function(hook) {
    // console.log('add-id: ' + util.inspect(hook.result, false, null)) 
    if (hook.result.data) hook.result.data.forEach(function(element) { element.id = element._id });
    else hook.result.id = hook.result._id
    return Promise.resolve(hook);
  };
};
