const axios = require('axios')
const https = require('https')
const sendElcert = require('../utils/send-elcert')
const server = 'https://securepayments.sberbank.ru'

async function checkOrder(app, orderId) {
  const token = app.get('sb_token')
  const httpsAgent = new https.Agent({ rejectUnauthorized: false })
  const { data: answer } = await axios.get(server + '/payment/rest/getOrderStatusExtended.do', { params: { token, orderId }, httpsAgent })
  // console.log('checkCert', answer);
  let status
  switch (answer.orderStatus) {
    case 2:
      const order = await app.service('orders').Model.findOne({ paymentId: orderId })
      const { _id, price, email, recipient } = order
      const D = new Date()
      const expiredAt = D.setMonth(D.getMonth() + 12)
      const elcert = await app.service('elcerts').create({ price, sum: price, email, recipient, orderId: _id, expiredAt })
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
      return false
  }
  console.log('status', status);
  await app.service('orders').Model.updateOne({ paymentId: orderId }, { $set: { status } })
  return true
}

module.exports = checkOrder
