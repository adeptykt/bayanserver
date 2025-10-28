'use strict';

exports.searchRegex = function () {
    return function (hook) {
      const query = hook.params.query;
      for (let field in query) {
        if(query[field].$search && field.indexOf('$') == -1) {
          query[field] = { $regex: new RegExp(query[field].$search) }
        }
        if(field == '$or') {
          let plain = [];
          query[field].map((action, index) => {
              let f = Object.keys(action)[0];
              if(action[f].$search) {
                  let q = {};
                  let v = parseInt(action[f].$search) == action[f].$search ? parseInt(action[f].$search) : action[f].$search;
                  q[f] = v;
                  plain.push(q);
                  action[f] = { $regex: new RegExp(action[f].$search, 'i') };
              }
              return action;
          });
          query[field] = query[field].concat(plain);
          console.log('$or', query[field]);
        }
      }
      hook.params.query = query
      return hook
    }
  }
  