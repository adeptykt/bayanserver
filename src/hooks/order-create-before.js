const { get, set } = require('lodash')
const uuid4 = require('uuid4')

module.exports = (options = {}) => async hook => {
  if (hook.data) {
    const { email, recipient, price } = hook.data
    const userId = hook.params.user._id
    const patternEmail = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

    if (!patternEmail.test(email)) {
      throw new Error('Неверный email')
    }
    if (!(price >= 500 && price <= 50000)) {
      throw new Error('Должно быть не менее 500 и не более 50 000')
    }
    if (recipient.trim() == '') {
      throw new Error('Незаполнено ФИО получателя сертификата')
    }
    const idempotenceKey = uuid4()
    if (userId) set(hook.data, 'userId', userId)
    set(hook.data, 'total', price * 1.05)
    set(hook.data, 'status', 'pending')
    set(hook.data, 'idempotenceKey', idempotenceKey)

    Promise.resolve(hook)
  }
}
