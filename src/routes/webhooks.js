/**
 * Webhook эндпоинты для платежных систем и внешних сервисов
 */

const sendElcert = require('../utils/send-elcert');
const checkOrder = require('../utils/check-order');

module.exports = function(app) {
  
  /**
   * Webhook от платежной системы (Сбербанк)
   */
  app.use('/payment', async (req, res) => {
    console.log('/payment body', req.body);
    
    const paymentId = req.body.object.id;
    const status = req.body.object.status;

    try {
      const order = await app.service('orders').Model.findOne({ paymentId });
      
      if (!order) {
        console.log('payment ' + paymentId + ' not found');
        return res.send('notfound');
      }
      
      console.log('payment order', order);
      
      const { _id, price, email, recipient, userId } = order;
      await app.service('orders').Model.updateOne({ _id }, { $set: { status } });
      
      const D = new Date();
      const expiredAt = D.setMonth(D.getMonth() + 12);
      
      await app.service('elcerts').create({ 
        price, 
        sum: price, 
        email, 
        userId, 
        recipient, 
        orderId: _id, 
        expiredAt 
      });
      
      res.send('ok');
    } catch (error) {
      console.error('Payment webhook error:', error);
      res.send({ errorCode: 'error', message: error.message });
    }
  });

  /**
   * Отправить сертификат по email (тестовый эндпоинт)
   */
  app.use('/v1/sendmail', async (req, res) => {
    console.log('sendmail');
    try {
      await sendElcert('m135et@gmail.com', 666, 150000, 'Иванов Петр Иванович', new Date());
      res.send({ message: 'ok' });
    } catch (error) {
      res.send({ errorCode: 'error', message: error.message });
    }
  });

  /**
   * Отправить заказ (сертификат)
   */
  app.use('/v1/sendorder', async (req, res) => {
    console.log('sendorder');
    const number = Number(req.query.number);
    
    try {
      const order = await app.service('orders').Model.findOne({ number });
      
      if (!order) {
        console.log('order ' + number + ' not found');
        return res.send('order ' + number + ' not found');
      }
      
      const elcert = await app.service('elcerts').Model.findOne({ orderId: order._id });
      
      if (!elcert) {
        console.log('Certificate not found');
        return res.send('Certificate not found');
      }
      
      await sendElcert(elcert.email, elcert.number, elcert.price, elcert.recipient, elcert.expiredAt);
      res.send(elcert);
    } catch (error) {
      console.error('Send order error:', error);
      res.send({ errorCode: 'error', message: error.message });
    }
  });

  /**
   * Отправить сертификат
   */
  app.use('/v1/sendcert', async (req, res) => {
    console.log('sendcert');
    const number = Number(req.query.number);
    const email = req.query.email;
    const query = email ? { email } : { number };
    
    try {
      const elcert = await app.service('elcerts').Model.findOne(query);
      
      if (!elcert) {
        console.log('Certificate not found');
        return res.send({ error: 'Certificate not found', query });
      }
      
      await sendElcert(elcert.email, elcert.number, elcert.price, elcert.recipient, elcert.expiredAt);
      await sendElcert('m135et@gmail.com', elcert.number, elcert.price, elcert.recipient, elcert.expiredAt);
      res.send(elcert);
    } catch (error) {
      console.error('Send cert error:', error);
      res.send({ errorCode: 'error', message: error.message });
    }
  });

  /**
   * Найти сертификат
   */
  app.use('/v1/findcert', async (req, res) => {
    console.log('findcert');
    const number = Number(req.query.number);
    const email = req.query.email;
    const query = email ? { email } : { number };
    
    try {
      const elcert = await app.service('elcerts').Model.findOne(query);
      
      if (!elcert) {
        console.log('Certificate not found');
        return res.send({ message: 'Certificate not found', query });
      }
      
      res.send(elcert);
    } catch (error) {
      res.send({ errorCode: 'error', message: error.message });
    }
  });

  /**
   * Проверить статус заказа
   */
  app.use('/v1/checkorder', async (req, res) => {
    console.log('checkorder');
    const number = Number(req.query.number);
    
    try {
      const order = await app.service('orders').Model.findOne({ number });
      
      if (!order) {
        console.log('order ' + number + ' not found');
        return res.send('order ' + number + ' not found');
      }
      
      await checkOrder(app, order.paymentId);
      res.send({ message: 'ok' });
    } catch (error) {
      console.error('Check order error:', error);
      res.send({ errorCode: 'error', message: error.message });
    }
  });
};

