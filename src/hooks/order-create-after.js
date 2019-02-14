const { get, set } = require('lodash')
const YandexCheckout = require('yandex-checkout')
const uuid4 = require('uuid4')
const axios = require('axios')
const server = 'https://3dsec.sberbank.ru'
// const server = 'https://62.76.205.110'

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
        // console.log('order after', res);
      })
    }

    // console.log('order-create-after', hook.result);
    Promise.resolve(hook)
  }
}
