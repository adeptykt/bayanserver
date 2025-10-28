/**
 * Партнерские API эндпоинты
 */

const _ = require('lodash');
const { addDays, getLocalDate, toJSONLocal } = require('../utils/date-helpers');
const { sms } = require('../utils/sms');
const BonusService = require('../services/bonus.service');

// API ключ партнера (TODO: вынести в переменные окружения)
const APIKEY = process.env.PARTNER_API_KEY || "RW9uRHkzSGxhV3pZT10xaE1fbHBEJnFSMElsM0hwOmN2VnZiZTopVl5bQDg3Jj14Kms=";

/**
 * Middleware проверки API ключа
 */
function apikeyVerify(req, res, next) {
  if (req.header('x-api-key') === APIKEY) {
    next();
  } else {
    res.send({ errorCode: 1, message: 'Apikey incorrect' });
  }
  console.log('apikeyVerify: ' + req.originalUrl);
}

module.exports = function(app) {
  const bonusService = new BonusService(app);

  /**
   * Получить настройки компании
   */
  app.get('/v1/partner/company', apikeyVerify, (req, res) => {
    res.send({ MarketingSettings: { maxScoresDiscount: 50 } });
  });

  /**
   * Получить электронный сертификат
   */
  app.get('/v1/partner/elcert', apikeyVerify, async (req, res) => {
    if (!req.query.number) {
      return res.send({ errorCode: 'NumberNotExists', message: 'Нет номера сертификата' });
    }
    
    try {
      const response = await app.service('elcerts').find({ query: { number: req.query.number } });
      const results = response.data || response;
      
      if (!results.length) {
        res.send({ errorCode: 'CertNotFound', message: 'Сертификат не найден' });
      } else {
        res.send(results[0]);
      }
    } catch (error) {
      res.send({ errorCode: 'errorMongo', message: error });
    }
  });

  /**
   * Получить клиента по телефону или коду
   */
  app.get('/v1/partner/customer', apikeyVerify, async (req, res) => {
    try {
      let user;
      if (req.query.phone) {
        user = await bonusService.getUserFromPhone(req.query.phone);
      } else {
        user = await bonusService.getUserFromToken(req.query.code);
      }
      res.send(user);
    } catch (error) {
      res.send(error);
    }
  });

  /**
   * Получить операции пользователя
   */
  app.get('/getuseroperations', async (req, res) => {
    try {
      const response = await app.service('users').find({ query: { phone: req.query.phone } });
      const results = response.data || response;
      
      if (!results.length) {
        res.send({ errorCode: 'phoneNotFound', message: 'Пользователь не найден' });
      } else {
        const user = results[0];
        user.operations = await bonusService.getUserOperations(user._id);
        res.send(user);
      }
    } catch (error) {
      res.send({ errorCode: 'error', message: error.message });
    }
  });

  /**
   * Получить пользователя по ID
   */
  app.get('/v1/partner/user', apikeyVerify, async (req, res) => {
    console.log('/v1/partner/user: ' + req.query.id);
    try {
      const user = await app.service('users').get(req.query.id);
      res.send(user);
    } catch (error) {
      res.send(error);
    }
  });

  /**
   * Получить список пользователей по баллам
   */
  app.get('/v1/partner/users', apikeyVerify, async (req, res) => {
    console.log('/v1/partner/users: ' + req.query.scoresgt);
    try {
      const results = await app.service('users').Model.find(
        { 
          scores: { $gt: req.query.scoresgt, $lt: req.query.scoreslt }, 
          isEnabled: true 
        },
        { name: 1, surname: 1, patronymic: 1, scores: 1 }
      );
      res.send(results);
    } catch (error) {
      res.send({ errorCode: 'error', message: error.message });
    }
  });

  /**
   * Начислить бонусы на день рождения
   */
  app.post('/v1/partner/birthdays', apikeyVerify, async (req, res) => {
    console.log('/v1/partner/birthdays!');
    
    const accrual = 500;
    const monthgte = parseInt(req.query.dategte.substr(5, 2));
    const daygte = parseInt(req.query.dategte.substr(8, 2));
    const monthlte = parseInt(req.query.datelte.substr(5, 2));
    const daylte = parseInt(req.query.datelte.substr(8, 2));
    
    const matches = req.body.text.match(/\$\{\w+\}/);
    const projection = { 
      _id: 1, name: 1, surname: 1, patronymic: 1, scores: 1, phone: 1, 
      isEnabled: 1, birthDate: 1, 
      month: { $month: "$birthDate" }, 
      day: { $dayOfMonth: "$birthDate" } 
    };
    
    if (matches) {
      matches.forEach(match => { 
        projection[match.slice(2, -1)] = 1;
      });
    }
    
    try {
      const results = await app.service('users').Model.aggregate([
        { $project: projection },
        { 
          $match: { 
            month: { $gte: monthgte, $lte: monthlte }, 
            day: { $gte: daygte, $lte: daylte }, 
            isEnabled: true 
          } 
        },
      ]);

      const expiredAt = new Date();
      expiredAt.setDate(expiredAt.getDate() + 20);
      expiredAt.setHours(23, 59, 59);

      for (const user of results) {
        let textsms = req.body.text.replace(/\$\{\w+\}/, str => user[str.slice(2, -1)]);
        Object.assign(user, { textsms, expiredAt });
        
        const newOperation = {
          userId: user._id,
          objectId: user._id,
          type: 4,
          scores: 0,
          accrual,
          expiredAt
        };
        
        if (req.body.action === "sendSMS") {
          await app.service('operations').create(newOperation);
          await app.service('notifications').create({ 
            userId: user._id, 
            message: `Начислено ${accrual} промо бонусов` 
          });
          sms(user.phone, textsms);
        }
      }
      
      console.log('/v1/partner/birthdays: ', results[0]);
      res.send(results);
    } catch (error) {
      console.log(error);
      res.send(error);
    }
  });

  /**
   * Получить операции пользователей
   */
  app.use('/v1/partner/operations', async (req, res) => {
    console.log('/v1/partner/operations: ' + req.query.userId);
    
    let query = { type: 1 };
    let userIds = [];
    let userarray = {};
    let usernames = {};
    let users;
    
    try {
      if (req.query.dategte) {
        const monthgte = parseInt(req.query.dategte.substr(5, 2));
        const daygte = parseInt(req.query.dategte.substr(8, 2));
        const monthlte = parseInt(req.query.datelte.substr(5, 2));
        const daylte = parseInt(req.query.datelte.substr(8, 2));
        const projection = { 
          _id: 1, name: 1, surname: 1, patronymic: 1, scores: 1, isEnabled: 1, 
          month: { $month: "$birthDate" }, 
          day: { $dayOfMonth: "$birthDate" } 
        };
        
        users = await app.service('users').Model.aggregate([
          { $project: projection },
          { 
            $match: { 
              month: { $gte: monthgte, $lte: monthlte }, 
              day: { $gte: daygte, $lte: daylte }, 
              isEnabled: true 
            } 
          },
        ]);
      } else {
        let usersQuery = {};
        if (req.query.userId) Object.assign(usersQuery, { _id: req.query.userId });
        if (req.query.isEnabled) Object.assign(usersQuery, { isEnabled: req.query.isEnabled });
        if (req.query.group) Object.assign(usersQuery, { group: req.query.group });
        
        users = await app.service('users').Model.find(usersQuery, { 
          _id: 1, surname: 1, name: 1, patronymic: 1, scores: 1, isEnabled: 1 
        });
      }
      
      users.forEach(user => {
        userarray[user._id] = user.scores;
        usernames[user._id] = `${user.surname} ${user.name} ${user.patronymic}`;
        userIds.push(user._id.toString());
      });
      
      if (req.query.date) query = Object.assign(query, { createdAt: { $gt: req.query.date } });
      query = Object.assign(query, { userId: { $in: userIds } });

      const operations = await app.service('operations').Model.find(query, { 
        invoiceNumber: 1, total: 1, scores: 1, cash: 1, accrual: 1, createdAt: 1, userId: 1 
      });
      
      const results = operations.map(operation => ({
        invoiceNumber: operation.invoiceNumber,
        total: operation.total,
        scores: -operation.scores,
        cash: operation.cash,
        accrual: operation.accrual,
        createdAt: operation.createdAt,
        username: usernames[operation.userId],
        rest: userarray[operation.userId],
        userId: operation.userId
      }));
      
      res.send(results);
    } catch (error) {
      res.send({ errorCode: 'error', message: error.message });
    }
  });

  /**
   * Массовая отправка SMS
   */
  app.post('/v1/partner/sms', apikeyVerify, async (req, res) => {
    console.log('/v1/partner/sms: ' + req.body.text);
    
    const matches = req.body.text.match(/\$\{\w+\}/);
    const projection = { name: 1, surname: 1, patronymic: 1, scores: 1, phone: 1 };
    
    if (matches) {
      matches.forEach(match => { 
        projection[match.slice(2, -1)] = 1;
      });
    }
    
    try {
      const results = await app.service('users').Model.find(
        { scores: { $gt: req.body.scoresgt, $lt: req.body.scoreslt }, isEnabled: true }, 
        projection
      );
      
      const processedResults = results.map(user => {
        const textsms = req.body.text.replace(/\$\{\w+\}/, str => user[str.slice(2, -1)]);
        if (req.body.action === "sendSMS") sms(user.phone, textsms);
        return Object.assign({ textsms }, { 
          name: user.name, 
          surname: user.surname, 
          patronymic: user.patronymic, 
          scores: user.scores, 
          phone: user.phone 
        });
      });
      
      if (req.body.action === "sendSMS") {
        await app.service('users').Model.update(
          { scores: { $gt: req.body.scoresgt, $lt: req.body.scoreslt } }, 
          { $addToSet: { group: req.body.group } }, 
          { multi: true }
        );
      }
      
      res.send(processedResults);
    } catch (error) {
      res.send({ errorCode: 'error', message: error.message });
    }
  });

  /**
   * Получить истекающие бонусы
   */
  app.post('/v1/partner/expired', apikeyVerify, async (req, res) => {
    let d = new Date(req.query.dategte);
    d = d.getTime() + (d.getTimezoneOffset() * 60000);
    const dategte = new Date(d);
    const datelte = new Date(req.query.datelte);
    
    console.log('/v1/partner/expired: ' + datelte);
    
    const query = { 
      status: 1, 
      type: 1, 
      expiredAt: { $lte: datelte, $gte: dategte }, 
      scores: { $gt: 150 } 
    };
    
    try {
      const results = await app.service('operations').Model.aggregate([
        { $match: query },
        { $group: { _id: { objectId: "$objectId", expiredAt: "$expiredAt", scores: "$accrual" } } },
        { $lookup: { from: "users", localField: "_id.objectId", foreignField: "_id", as: "user" } },
        { $unwind: "$user" },
        {
          $project: {
            "_id": 1,
            "surname": "$user.surname",
            "name": "$user.name",
            "patronymic": "$user.patronymic",
            "phone": "$user.phone",
            "scores": "$_id.scores",
            "expiredAt": "$_id.expiredAt",
          }
        }
      ]);
      
      const processedResults = results.map(result => 
        Object.assign(result, { textsms: req.body.text })
      );
      
      res.send(processedResults);
    } catch (error) {
      res.send({ errorCode: 'error', message: error.message });
    }
  });

  /**
   * Начислить бонусы
   */
  app.post('/v1/partner/accruebonuses', apikeyVerify, async (req, res) => {
    const newOperation = {
      userId: req.body.userId,
      objectId: req.body.userId,
      type: 4,
      scores: 0,
      accrual: req.body.accrual,
      expiredAt: req.body.expiredAt
    };
    
    try {
      const operation = await app.service('operations').create(newOperation);
      res.send({ operation });
    } catch (error) {
      res.send({ errorCode: 'error', message: error.message });
    }
  });

  /**
   * Создать покупку
   */
  app.post('/v1/partner/purchase', apikeyVerify, async (req, res) => {
    console.log('/v1/partner/purchase: ', req.body);
    
    try {
      const getUser = req.body.code.length === 10 
        ? bonusService.getUserFromPhone.bind(bonusService)
        : bonusService.getUserFromToken.bind(bonusService);
      
      const user = await getUser(req.body.code);
      const createdAt = req.body.createdAt ? new Date(req.body.createdAt) : new Date();
      const validAt = addDays(createdAt, 15, 'begin');
      const expiredAt = addDays(validAt, 365, 'end');
      
      const newOperation = {
        userId: user._id,
        objectId: user._id,
        type: 1,
        scores: -req.body.scores,
        cash: req.body.cash,
        cert: req.body.cert,
        total: req.body.total,
        accrual: req.body.accrual,
        invoiceNumber: req.body.invoiceNumber,
        kind: req.body.kind || 0,
        createdAt,
        validAt,
        expiredAt
      };
      
      const operation = await app.service('operations').create(newOperation);
      
      if (req.body.scores > 0) {
        await app.service('notifications').create({ 
          userId: user._id, 
          title: 'Байанай клуб', 
          message: `${req.body.scores} баллов реализовано` 
        });
      }
      
      res.send({ operation });
    } catch (error) {
      console.log('error purchase', error);
      res.send(error);
    }
  });

  /**
   * Отменить операцию
   */
  app.post('/v1/partner/revert', apikeyVerify, async (req, res) => {
    console.log('/v1/partner/revert: ', req.body);
    try {
      const operation = await app.service('operations').patch(req.body.id, { 
        status: 2, 
        expired: true 
      });
      res.send({ operation });
    } catch (error) {
      res.send({ errorCode: 'error', message: error.message });
    }
  });

  /**
   * Изменить данные покупки
   */
  app.post('/v1/partner/purchasepatch', apikeyVerify, async (req, res) => {
    console.log('/v1/partner/purchasepatch');
    try {
      const operation = await app.service('operations').patch(req.body.id, { 
        scores: -req.body.scores, 
        cert: req.body.cert, 
        cash: req.body.cash, 
        total: req.body.total 
      });
      res.send({ operation });
    } catch (error) {
      res.send({ errorCode: 'error', message: error.message });
    }
  });

  /**
   * Активировать карту
   */
  app.post('/v1/partner/card', apikeyVerify, async (req, res) => {
    const phone = req.body.phone;
    const code = req.body.code;
    
    try {
      if (code) {
        const response = await app.service('cards').find({ query: { code: req.body.code } });
        const results = response.data || response;
        
        if (!results.length) {
          const password = (Array(6).join("0") + Math.round(Math.random() * 999999)).slice(-6);
          const userData = Object.assign(_.omit(req.body, 'code'), { password, card: req.body.code });
          
          const user = await app.service('users').create(userData);
          const newCard = { code: req.body.code, userId: user._id };
          const card = await app.service('cards').create(newCard);
          
          const text = (user.name.length > 8 ? 'В' : `${user.name}, в`) + 
                      `аша карта активна. bayanay.store id ${user.phone} pass ${password}`;
          sms(user.phone, text);
          res.send(card);
        } else {
          res.send({ errorCode: 'cardExists', message: 'Карта уже зарегистрирована' });
        }
      } else {
        const response = await app.service('users').find({ query: { phone } });
        const results = response.data || response;
        
        if (!results.length) {
          const password = (Array(6).join("0") + Math.round(Math.random() * 999999)).slice(-6);
          const userData = Object.assign(_.omit(req.body, 'code'), { password });
          const user = await app.service('users').create(userData);
          
          const text = `Ваш доступ активирован bayanay.store id ${user.phone} pass ${password}`;
          sms(user.phone, text);
          res.send(user);
        } else {
          res.send({ errorCode: 'cardExists', message: 'Клиент с таким телефоном уже зарегистрирован' });
        }
      }
    } catch (error) {
      res.send({ errorCode: 'userCreateError', message: error.message });
    }
  });

  /**
   * Получить сертификат
   */
  app.get('/v1/partner/certificate', apikeyVerify, async (req, res) => {
    const number = Number(req.query.number);
    console.log('get certificate: ' + number);
    
    try {
      const response = await app.service('certificates').find({ query: { number } });
      const results = response.data || response;
      
      if (results.length > 0) {
        const certificate = results[0];
        if (req.query.info) {
          res.send(certificate);
        } else if (certificate.blocked) {
          res.send({ 
            errorCode: 'certificateGetError', 
            message: 'Сертификат заблокирован по причине: ' + certificate.reason 
          });
        } else if (certificate.canceledAt) {
          res.send({ 
            errorCode: 'certificateGetError', 
            message: 'Сертификат погашен ' + toJSONLocal(certificate.canceledAt) 
          });
        } else {
          res.send(certificate);
        }
      } else {
        res.send({ errorCode: 'certificateGetError', message: 'Сертификат не зарегистрирован' });
      }
    } catch (error) {
      res.send({ errorCode: 'error', message: error.message });
    }
  });

  /**
   * Обновить сертификат
   */
  app.post('/v1/partner/certificate', apikeyVerify, async (req, res) => {
    const id = req.body._id;
    delete req.body._id;
    console.log('post certificate:', req.body);
    
    try {
      const response = await app.service('certificates').update(id, req.body);
      const results = response.data || response;
      if (results.length > 0) {
        res.send(results[0]);
      }
    } catch (error) {
      res.send({ errorCode: 'error', message: error.message });
    }
  });

  /**
   * Частично обновить сертификат
   */
  app.post('/v1/partner/certificatepatch', apikeyVerify, async (req, res) => {
    req.body.soldAt = new Date(req.body.soldAt);
    const id = req.body._id;
    delete req.body._id;
    console.log('certificatepatch', req.body, new Date(req.body.soldAt));
    
    try {
      const certificate = await app.service('certificates').patch(id, { 
        saleStore: req.body.saleStore, 
        soldAt: req.body.soldAt, 
        saleNumber: req.body.saleNumber, 
        saleType: req.body.saleType 
      });
      console.log('Сертификат успешно ' + req.body.number + ' обновлен', certificate);
      res.send(certificate);
    } catch (error) {
      res.send({ errorCode: 'error', message: error.message });
    }
  });

  /**
   * Операции с сертификатами (пакетная обработка) v1
   */
  app.post('/v1/partner/certificates', apikeyVerify, async (req, res) => {
    console.log('certificates: ');
    const action = req.body.action;
    
    try {
      const certificates = await Promise.all(req.body.certificates.map(async number => {
        const response = await app.service('certificates').find({ query: { number } });
        const results = response.data || response;
        let certificate = {}, error, result = {};
        
        if (!results.length) {
          if (action === 'create') {
            certificate = await app.service('certificates').create({ 
              productId: req.body.productId, 
              store: req.body.store, 
              sum: req.body.sum, 
              number, 
              price: req.body.sum 
            });
          } else {
            error = 'Сертификат не зарегистрирован';
          }
        } else {
          certificate = results[0];
          if (action === 'create') {
            error = 'Сертификат уже зарегистрирован';
          } else {
            if (action === 'sale' && certificate.soldAt) {
              error = 'Сертификат уже продан ' + toJSONLocal(certificate.soldAt);
            }
            if ((action === 'sale' || action === 'cancel') && certificate.canceledAt) {
              error = 'Сертификат погашен ' + toJSONLocal(certificate.canceledAt);
            }
            if (!error) {
              if (action === 'sale') {
                certificate = await app.service('certificates').patch(certificate._id, { 
                  saleStore: req.body.store, 
                  soldAt: new Date(), 
                  saleNumber: req.body.docNumber, 
                  saleType: req.body.docType 
                });
              } else if (action === 'cancel') {
                await app.service('redemptions').create({ 
                  certificateId: certificate._id, 
                  store: req.body.store, 
                  docNumber: req.body.docNumber, 
                  docType: req.body.docType, 
                  sum: req.body.sum 
                });
              }
            }
          }
        }
        if (certificate) Object.assign(result, certificate);
        if (error) Object.assign(result, { error });
        return result;
      }));
      
      console.log('Сертификаты успешно ' + action + ': ', certificates);
      res.send(certificates);
    } catch (error) {
      res.send({ errorCode: 'error', message: error.message });
    }
  });

  /**
   * Операции с сертификатами v2 (поддержка электронных сертификатов)
   */
  app.post('/v2/partner/certificates', apikeyVerify, async (req, res) => {
    console.log('v2certificates');
    const action = req.body.action;
    
    try {
      const certificates = await Promise.all(req.body.certificates.map(async ({ number, sum }) => {
        const isElcert = req.body.productId === '00000000001';
        
        if (isElcert && action !== 'cancel') {
          return { error: 'Неправильное действие для электронного сертификата' };
        }
        
        const certs = isElcert ? 'elcerts' : 'certificates';
        const reds = isElcert ? 'ecredemptions' : 'redemptions';
        
        const response = await app.service(certs).find({ query: { number } });
        const results = response.data || response;
        let error;
        let certificate = {}, result = {};
        
        if (!results.length) {
          if (action === 'create') {
            certificate = await app.service(certs).create({ 
              number, 
              productId: req.body.productId, 
              store: req.body.store, 
              sum: req.body.sum, 
              price: req.body.sum 
            });
          } else {
            error = 'Сертификат не зарегистрирован';
          }
        } else {
          certificate = results[0];
          if (action === 'create') {
            if (!certificate.canceled) {
              certificate = await app.service(certs).patch(certificate._id, { 
                productId: req.body.productId, 
                store: req.body.store, 
                sum: req.body.sum, 
                price: req.body.sum 
              });
            }
          } else {
            if (action === 'sale' && certificate.soldAt) {
              error = 'Сертификат уже продан';
            }
            if ((action === 'sale' || action === 'cancel') && certificate.canceledAt) {
              error = 'Сертификат погашен ' + toJSONLocal(certificate.canceledAt);
            }
            if (!error) {
              if (action === 'sale') {
                certificate = await app.service(certs).patch(certificate._id, { 
                  saleStore: req.body.store, 
                  soldAt: new Date(), 
                  saleNumber: req.body.docNumber, 
                  saleType: req.body.docType 
                });
              } else if (action === 'cancel') {
                await app.service(reds).create({ 
                  certificateId: certificate._id, 
                  store: req.body.store, 
                  docNumber: req.body.docNumber, 
                  docType: req.body.docType, 
                  sum 
                });
              }
            }
          }
        }
        
        if (certificate) Object.assign(result, certificate);
        if (error) Object.assign(result, { certificate, error });
        return result;
      }));
      
      res.send(certificates);
    } catch (error) {
      res.send({ errorCode: 'error', message: error.message });
    }
  });

  /**
   * Удалить сертификаты
   */
  app.delete('/v1/partner/certificate', apikeyVerify, async (req, res) => {
    const gte = Number(req.query.start);
    const lte = Number(req.query.end);
    console.log('delete certificate: ', gte, lte);
    
    try {
      await app.service('operations').Model.remove({ type: 3 });
      await app.service('certificates').Model.remove({ number: { $gte: gte, $lte: lte } });
      res.send({ message: 'ok' });
    } catch (error) {
      res.send({ errorCode: 'error', message: error.message });
    }
  });

  /**
   * Получить операцию
   */
  app.get('/v1/partner/operation', apikeyVerify, async (req, res) => {
    try {
      const operation = await app.service('operations').get(req.query.id);
      res.send(operation);
    } catch (error) {
      res.send(error);
    }
  });

  /**
   * Изменить операцию
   */
  app.post('/v1/partner/operation', apikeyVerify, async (req, res) => {
    try {
      const operation = await app.service('operations').get(req.query.id);
      const scores = req.query.scores;
      await app.service('operations').patch(req.query.id, { scores });
      res.send(operation);
    } catch (error) {
      res.send(error);
    }
  });
};

