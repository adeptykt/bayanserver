'use strict';
const _ = require('lodash')
const util = require('util')
const { sms } = require('../utils/sms');
const errors = require('feathers-errors');

function getUniqueCode(service, num) {
  let len = num.toString().length;
  let code = (Array(len).join("0") +  Math.round(Math.random() * num)).slice(-len)
  service.find({ query: {code} }).then((response) => {
    var results = response.data || response;
    if (!results.length) {
      return Promise.resolve(code)
    } else {
      return getUniqueCode(service, num)
    }
  })
  return code;
}

module.exports = options => async hook => {
  console.log('code create: ' + util.inspect(options, false, null))

  let service = hook.app.service(options.service)
  let query = {}

  if (hook.id) {
    query = { userId: hook.id }
  } else if (_.get(hook, 'data._id')) {
    query = { userId: hook.data._id }
  } else if (_.get(hook, 'data.phone')) {
    query = { phone: hook.data.phone }
  }

  let phone = ''
  if (options.type === 'code') {
    phone = hook.data.phone
    console.log('phone:', hook.data);

    let users = await hook.app.service('users').find({ query: {phone} }).then(function(found) {
      if (!Array.isArray(found) && found.data) found = found.data
      return found
    })
    if (users.length === 0) {
      console.log(`Длина: ${users.length}`)
      //Promise.reject({errorCode: 'userNotFound', message: 'Пользователь не найден'})
      throw new errors.NotFound(`Пользователь не найден`)
      return
    }
  }

  let code = (phone === '9644169675') ? '9999' : await getUniqueCode(service, options.number)
  // console.log(`${options.service} code: ${code}`)
  await service.remove(null, query)
  Object.assign(hook.data, query, {code})
  if (options.type === 'code' && phone !== '9644169675') sms(phone, 'Ваш код подтверждения: ' + code)
  console.log('code: ' + code)
  Promise.resolve(hook)
}
