const { get, set } = require('lodash')
const YandexCheckout = require('yandex-checkout')
const uuid4 = require('uuid4')
const axios = require('axios')
const sendElcert = require('../utils/send-elcert')
const server = 'https://securepayments.sberbank.ru'
// const server = 'https://62.76.205.110'

async function checkCert(app, orderId) {
  const token = app.get('sb_token')
  const { data: answer } = await axios.get(server + '/payment/rest/getOrderStatusExtended.do', { params: { token, orderId } })
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

timerCheck = (app, orderId) => async () => {
  console.log('timerCheck', orderId);
  const result = await checkCert(app, orderId)
  console.log('timerCheck result', result);
  if (!result) setTimeout(timerCheck(app, orderId), 30000)
}

module.exports = (options = {}) => async hook => {
  if (hook.data) {
    const token = hook.app.get('sb_token')
    // const shopId = hook.app.get('yandex_shopId')
    // const secretKey = hook.app.get('yandex_secretKey')
    // const yandexCheckout = YandexCheckout(shopId, secretKey)
    const { _id: orderId, price, total, idempotenceKey, number } = hook.result

    // const payment = await yandexCheckout.createPayment({
    //   amount: {
    //     value: price,
    //     currency: 'RUB'
    //   },
    //   payment_method_data: {
    //     type: 'bank_card'
    //   },
    //   confirmation: {
    //     type: 'redirect',
    //     // return_url: 'http://bayanay.center/paid'
    //     return_url: 'http://localhost:3001/certificates'
    //   },
    //   capture: true,
    //   metadata: {
    //     orderId
    //   },
    //   description: "Заказ №" + number
    // }, idempotenceKey)
    // set(hook.result, 'confirmation_url', payment.confirmation.confirmation_url)
    // hook.app.service('orders').Model.updateOne({ _id: orderId }, { $set: { paymentId: payment.id } }).then(res => {
    //   console.log('order after', res);
    // })

    const payment = {
      token,
      orderNumber: number.toString(),
      amount: total * 100,
      // returnUrl: 'http://localhost:3001/certificates',
      returnUrl: 'http://bayanay.center/certificates',
      description: "Заказ №" + number
    }
    // console.log('payment', payment);

    // axios.interceptors.request.use(request => {
    //   console.log('Starting Request', request)
    //   return request
    // })

    // const { data: answer } = await axios.post(server + '/payment/rest/register.do', payment)
    // axios({
    // 	method: 'POST',
    // 	headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    //   baseURL: server,
    // 	url: '/payment/rest/register.do',
    // 	data: payment
    // })

    const { data: answer } = await axios.get(server + '/payment/rest/register.do', { params: payment })
    // console.log('answer', answer);
    if (answer.errorCode) {
      set(hook.result, 'errorCode', answer.errorCode)
      set(hook.result, 'errorMessage', answer.errorMessage)
    } else {
      set(hook.result, 'confirmation_url', answer.formUrl)
      hook.app.service('orders').Model.updateOne({ _id: orderId }, { $set: { paymentId: answer.orderId } }).then(res => {
        setTimeout(timerCheck(hook.app, answer.orderId), 60000)
      })
    }

    // console.log('order-create-after', hook.result);
    Promise.resolve(hook)
  }
}
