const { get, set } = require('lodash')
const { getItems } = require('feathers-hooks-common')
const YandexCheckout = require('yandex-checkout')

module.exports = (options = {}) => async hook => {
  if (hook.data) {
    const shopId = hook.app.get('yandex_shopId')
    const secretKey = hook.app.get('yandex_secretKey')
    const yandexCheckout = YandexCheckout(shopId, secretKey)
    const { status, _id } = hook.data

    const res = await hook.app.service('orders').Model.findOne({ _id })

    console.log('set-order-status', res);
    if (res.paymentId) {
      // yandexCheckout.getPayment(res.paymentId).then(res => {
      //   console.log('set-order-status2', res);
      // })
    }

    Promise.resolve(hook)
  }
}
