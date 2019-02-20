const { get, set } = require('lodash')
const axios = require('axios')
const server = 'https://securepayments.sberbank.ru'
const sendElcert = require('../utils/send-elcert')

module.exports = async hook => {
  console.log('check-elcerts');
  const token = hook.app.get('sb_token')
  // const { _id: orderId, price, idempotenceKey, number } = hook.result
  if (hook.params.user) {
    const userId = hook.params.user._id
    const orders = await hook.app.service('orders').Model.find({ userId, status: 'pending' })

    orders.forEach(async order => {
      const { data: answer } = await axios.get(server + '/payment/rest/getOrderStatusExtended.do', { params: { token, orderId: order.paymentId } })
      let status
      switch (answer.orderStatus) {
        case 2:
          const { _id: orderId, price, email, recipient } = order
          // const Elcert = hook.app.service('elcerts').Model
          // const elcert = new Elcert({ price, sum: price, email, userId, recipient, orderId })
          // await elcert.save()
          const D = new Date()
          const expiredAt = D.setMonth(D.getMonth() + 12)
          const elcert = await hook.app.service('elcerts').create({ price, sum: price, email, userId, recipient, orderId, expiredAt })
          console.log('elcert', elcert);
          sendElcert(email, elcert.number, price, recipient, elcert.expiredAt)
          status = 'succeeded'
          break
        case 6:
          status = 'expired'
          break
        case 3:
          status = 'canceled'
          break
        default:
          return
      }
      console.log('status', order.paymentId, status);
      await hook.app.service('orders').Model.updateOne({ _id: order._id }, { $set: { status } })
    })
  }
  Promise.resolve(hook)
}
