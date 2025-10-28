/**
 * Утилитарные эндпоинты для отладки и миграций
 */

const { ucFirst } = require('../utils/string-helpers');
const { addDays, toJSONLocal, startday } = require('../utils/date-helpers');
const BonusService = require('../services/bonus.service');

module.exports = function(app) {
  const bonusService = new BonusService(app);

  /**
   * Push уведомление (тестовый эндпоинт)
   */
  app.use('/push', {
    get(message) {
      app.io.emit('notification', { title: 'title', message });
      return Promise.resolve({ code: 'push sent' });
    }
  });

  /**
   * Обновление сертификатов (миграция sum)
   */
  app.use('/cert', async (req, res) => {
    console.log('cert');
    try {
      const results = await app.service('redemptions').Model.aggregate([
        { $match: { sum: { $exists: false } } },
        { $lookup: { from: "certificates", localField: "certificateId", foreignField: "_id", as: "certificate" } },
        { $unwind: "$certificate" },
        {
          $project: {
            "_id": 1,
            "sum": "$certificate.sum",
            "createdAt": 1,
          }
        }
      ]);
      
      for (const result of results) {
        await app.service('redemptions').patch(result._id, { sum: result.sum });
        console.log('Updated:', result);
      }
      res.send(results);
    } catch (error) {
      res.send(error);
    }
  });

  /**
   * Обновление операций (deprecated)
   */
  app.use('/updateoperations', (req, res) => {
    console.log('updateoperations');
    res.send({ res: "ok" });
  });

  /**
   * Очистка операций (deprecated)
   */
  app.use('/clearoperations', (req, res) => {
    console.log('clearoperations');
    res.send({ res: "ok" });
  });

  /**
   * Проверка операций
   */
  app.use('/checkoperations', async (req, res) => {
    console.log('checkoperations1: ' + req.query.store);
    
    try {
      const results = await app.service('operations').Model.aggregate([
        { $match: { type: 1 } },
        { 
          $project: { 
            diff: { 
              $subtract: [
                { $subtract: [{ $add: ["$cash", { $ifNull: ["$cert", 0] }] }, "$scores"] }, 
                "$total"
              ] 
            }, 
            total: 1, 
            cash: 1, 
            cert: { $ifNull: ["$cert", 0] }, 
            scores: 1, 
            invoiceNumber: 1 
          } 
        },
        { $match: { diff: { $ne: 0 } } },
        { $limit: 10 },
      ]);
      
      console.log('checkoperations2');
      results.forEach(result => console.log('Result:', result));
      res.send(results);
    } catch (error) {
      console.log('error', error);
      res.send(error);
    }
  });

  /**
   * Группы пользователей (deprecated)
   */
  app.use('/group', (req, res) => {
    console.log('/group: ' + req.body.text);
    res.send({ message: 'deprecated' });
  });

  /**
   * Расчет expiredAt
   */
  app.use('/expiredAt', (req, res) => {
    console.log('/expiredAt');
    const expiredAt = addDays(new Date(), 183, 'end');
    console.log('expiredAt:', toJSONLocal(expiredAt));
    res.send(expiredAt);
  });

  /**
   * Проверка телефонов
   */
  app.use('/checkphone', {
    async find() {
      console.log('checkphone');
      try {
        const response = await app.service('users').find({ query: { phone: /^9242/ } });
        const results = response.data || response;
        
        if (!results.length) {
          return Promise.resolve({ message: 'Users not found' });
        }
        
        for (const user of results) {
          if (user.phone.length === 11) {
            const phone = user.phone.slice(1);
            const updated = await app.service('users').patch(user._id, { phone });
            console.log(`${user.phone} изменен на ${updated.phone}`);
          } else if (user.phone.length === 12) {
            console.log('Wrong number: ' + JSON.stringify(user));
          }
        }
        return Promise.resolve(results);
      } catch (error) {
        return Promise.reject(error);
      }
    }
  });

  /**
   * Проверка карт
   */
  app.use('/checkcards', async (req, res) => {
    console.log('checkcards');
    try {
      const results = await app.service('cards').Model.find({ $where: "this.code.length < 13" });
      results.forEach(card => {
        console.log('card: ' + card.code + ' - ' + card.createdAt);
      });
      res.send('ok');
    } catch (error) {
      res.send({ errorCode: 'error', message: error.message });
    }
  });

  /**
   * Проверка и исправление имен
   */
  app.use('/checknames', async (req, res) => {
    console.log('checknames');
    const query = /^[^А-Я]|\s$|^[А-Я].*[А-Я]/;
    
    try {
      const results = await app.service('users').Model.find({ 
        $or: [{ surname: query }, { name: query }, { patronymic: query }] 
      });
      
      if (!results.length) {
        return res.send('Users not found');
      }
      
      let httpList = "";
      for (const user of results) {
        const surname = ucFirst(user.surname);
        const name = ucFirst(user.name);
        const patronymic = ucFirst(user.patronymic);
        httpList += `<div>"${user.surname}" "${user.name}" "${user.patronymic}" => "${surname}" "${name}" "${patronymic}"</div>`;
        await app.service('users').patch(user._id, { surname, name, patronymic });
      }
      res.send(httpList);
    } catch (error) {
      res.send(error);
    }
  });

  /**
   * Проверка баллов
   */
  app.use('/checkbonuses', async (req, res) => {
    console.log('checkbonuses1');
    
    const currentDate = startday(new Date());
    const datelte = addDays(currentDate, -1, 'begin');
    
    try {
      const results = await app.service('operations').Model.aggregate([
        { $match: { status: 1 } },
        {
          $project: {
            objectId: 1,
            createdAt: 1,
            scores: 1,
            accrual: {
              $cond: {
                if: { $lte: [{ $ifNull: ["$validAt", datelte] }, datelte] },
                then: { $ifNull: ["$accrual", 0] },
                else: 0
              }
            },
          }
        },
        {
          $project: {
            objectId: 1,
            createdAt: 1,
            scores: 1,
            accrual: 1,
            amount: { $add: ["$accrual", "$scores"] }
          }
        },
        {
          $group: {
            _id: "$objectId",
            accrual: { $sum: "$accrual" },
            scores: { $sum: "$scores" },
            amount: { $sum: "$amount" }
          }
        },
        { $match: { amount: { $gt: 0 } } },
        { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
        { $unwind: "$user" },
        {
          $project: {
            objectId: "$_id",
            phone: "$user.phone",
            card: "$user.card",
            scores: "$user.scores",
            mAccrual: "$accrual",
            mScores: "$scores",
            amount: 1
          }
        },
        { $match: { $expr: { $ne: ["$scores", "$amount"] } } }
      ]);
      
      console.log('checkbonuses2');
      let httpList = '<table border="1"><tr><th>userId</th><th>phone</th><th>card</th><th>scores</th><th>amount</th></tr>';
      results.forEach(o => {
        httpList += `<tr><td>${o.objectId}</td><td>${o.phone}</td><td>${o.card}</td><td>${o.scores}</td><td>${o.amount}</td></tr>`;
      });
      httpList += '</table>';
      res.send(httpList);
    } catch (error) {
      console.log('error: ' + error);
      res.send(error);
    }
  });

  /**
   * День рождения (миграция)
   */
  app.use('/birthday', async (req, res) => {
    console.log('birthday');
    try {
      const results = await app.service('users').Model.find({ "birthday": { "$exists": false } });
      
      if (!results.length) {
        return res.send('Users not found');
      }
      
      console.log('length: ' + results.length);
      let httpList = "";
      
      for (const user of results) {
        try {
          if (!user.birthDate) {
            throw new Error('No birthDate');
          }
          const birthday = `${('0' + user.birthDate.getDate()).slice(-2)}-${('0' + (user.birthDate.getMonth() + 1)).slice(-2)}-${user.birthDate.getFullYear()}`;
          console.log(`${user.surname} ${user.name} ${user.patronymic} - ${birthday}`);
          await app.service('users').patch(user._id, { birthday });
        } catch (error) {
          console.log(`----${user.surname} ${user.name} ${user.patronymic}`);
        }
      }
      res.send(httpList);
    } catch (error) {
      res.send(error);
    }
  });

  /**
   * Пользователи по дате последней активности
   */
  app.use('/userssortbydate', {
    async find() {
      const expiredAt = new Date(2023, 1, 26, 23, 59, 59);
      const users = await app.service('users').Model.aggregate([
        { $project: { lastDate: 1, phone: 1, surname: 1, name: 1, patronymic: 1, createdAt: 1 } },
        { $sort: { lastDate: -1 } },
      ]);
      
      const results = users.map(user => {
        const accrual = 1000;
        const newOperation = {
          userId: user._id,
          objectId: user._id,
          type: 4,
          scores: 0,
          accrual,
          kind: 1,
          expiredAt
        };
        app.service('operations').create(newOperation);
        return { phone: user.phone, name: user.name, surname: user.surname, patronymic: user.patronymic };
      });
      
      return Promise.resolve({ users: results });
    }
  });

  /**
   * Установить последнюю дату пользователям
   */
  app.use('/setuserslastdate', {
    async find() {
      return Promise.resolve({ result: 'ok' });
    }
  });

  /**
   * Проверить истекшие бонусы
   */
  app.use('/checkexpired', async (req, res) => {
    await bonusService.checkExpired('writeOff');
    res.send('ok');
  });

  /**
   * Проверить баллы (отрицательные)
   */
  app.use('/checkscores', async (req, res) => {
    console.log('checkscores');
    try {
      const response = await app.service('users').find({ query: { scores: { $lt: 0 } } });
      const results = response.data || response;
      
      if (results.length) {
        results.forEach(user => {
          console.log('phone: ' + user.phone + ' scores: ' + user.scores + ' id: ' + user._id);
        });
      }
      res.send('ok');
    } catch (error) {
      res.send({ errorCode: 'error', message: error.message });
    }
  });

  /**
   * Проверить истечение у пользователя
   */
  app.use('/checkuserexpired', async (req, res) => {
    const userId = "5c6a683b970971ba4858f3ca";
    const query = { userId };
    
    try {
      const response = await app.service('operations').Model.find(query);
      res.send(response);
    } catch (error) {
      res.send({ errorCode: 'error', message: error.message });
    }
  });

  /**
   * Проверка операций 2
   */
  app.use('/checkoperations2', async (req, res) => {
    const datelte = "2023-02-28T00:00:00.000Z";
    const dategte = "2023-02-27T20:59:59.000Z";
    const query = { createdAt: { $lte: datelte, $gte: dategte }, status: 1, type: 2, kind: { $ne: 1 } };
    
    try {
      const response = await app.service('operations').Model.find(query);
      response.map(op => app.service('operations').patch(op._id, { kind: 1 }));
      res.send(response);
    } catch (error) {
      res.send({ errorCode: 'error', message: error.message });
    }
  });

  /**
   * Блокировка сертификатов
   */
  app.use('/blockcertificates', async (req, res) => {
    const gte = Number(req.query.start);
    const lte = Number(req.query.end);
    console.log('blockcertificates', gte, lte);
    
    try {
      await app.service('certificates').Model.update(
        { number: { $gte: gte, $lte: lte } }, 
        { $set: { reason: req.query.reason, blocked: true } }, 
        { multi: true }
      );
      res.send('ok');
    } catch (error) {
      res.send('error: ' + error.message);
    }
  });

  /**
   * Разблокировка сертификатов
   */
  app.use('/unblockcertificates', async (req, res) => {
    const gte = Number(req.query.start);
    const lte = Number(req.query.end);
    console.log('unblockcertificates', gte, lte);
    
    try {
      await app.service('certificates').Model.update(
        { number: { $gte: gte, $lte: lte } }, 
        { $set: { blocked: false } }, 
        { multi: true }
      );
      res.send('ok');
    } catch (error) {
      res.send('error: ' + error.message);
    }
  });

  /**
   * Проверка типов (kind)
   */
  app.use('/checkkind', {
    async find(hook) {
      const limit = Number(hook.query['$limit']);
      const skip = Number(hook.query['$skip']);
      
      console.log('checkKind: ', hook.query);
      
      const model = app.service('operations').Model;
      const users = await model.aggregate([
        { $match: { kind: 1, status: 1 } },
        { $group: { _id: "$objectId", scores: { $sum: "$scores" }, cash: { $sum: "$cash" }, accrual: { $sum: "$accrual" }, total: { $sum: "$total" }, count: { $sum: "$count" } } },
        { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
        { $unwind: "$user" },
        {
          $project: {
            userId: "$userId",
            objectId: "$objectId",
            name: "$user.name",
            phone: "$user.phone",
            total: "$total",
            accrual: "$accrual",
            scores: "$scores"
          }
        },
        { $skip: skip },
        { $limit: limit }
      ]);
      
      return { data: users };
    }
  });
};

