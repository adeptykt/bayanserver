/**
 * Сервис для работы с бонусной системой
 */

const { addDays, getLocalDate, toJSONLocal } = require('../utils/date-helpers');
const { sms } = require('../utils/sms');

class BonusService {
  constructor(app) {
    this.app = app;
  }

  /**
   * Получить операции пользователя с учетом истечения срока
   */
  async getUserOperations(userId) {
    const objectId = typeof userId === 'string' 
      ? global.mongoose.Types.ObjectId(userId) 
      : userId;

    const operations = await this.app.service('operations').Model.aggregate([
      { 
        $match: { 
          objectId, 
          $or: [{ expired: { $exists: false } }, { expired: false }], 
          status: 1, 
          type: { $in: [1, 4] } 
        } 
      },
    ]);

    return operations.reduce(async (accumulator, operation) => {
      const kind = operation.kind || 0;
      
      const results = await this.app.service('operations').Model.aggregate([
        { $addFields: { 
          kind: { $ifNull: ["$kind", 0] }, 
          scores: { $ifNull: ["$scores", 0] }, 
          accrual: { $ifNull: ["$accrual", 0] } 
        }},
        { $match: { objectId, status: 1, kind } },
        {
          $project: {
            scores1: {
              $cond: {
                if: { $lt: ['$createdAt', operation.createdAt] },
                then: { $sum: ["$scores", "$accrual"] },
                else: 0
              }
            },
            scores2: {
              $cond: {
                if: { $gt: ['$createdAt', operation.createdAt] },
                then: '$scores',
                else: 0
              }
            }
          }
        },
        { $group: { _id: 0, scores1: { $sum: '$scores1' }, scores2: { $sum: '$scores2' } } }
      ]);

      const scores1 = results.length ? Math.round((results[0].scores1) * 100) / 100 : 0;
      const scores2 = results.length ? Math.round((results[0].scores2) * 100) / 100 : 0;
      let delta = Math.round((scores1 + scores2) * 100) / 100;
      delta = delta > operation.accrual ? operation.accrual : delta < 0 ? 0 : delta;

      console.log(operation.name + ' accrual: ' + operation.accrual + 
                  ' scores1: ' + scores1 + ' scores2: ' + scores2 + ' delta: ' + delta);
      
      if (delta < operation.accrual) {
        operation.accrual -= delta;
        return (await accumulator).concat(operation);
      }
      return await accumulator;
    }, Promise.resolve([]));
  }

  /**
   * Пересчитать баллы пользователя
   */
  async calcScores(userId) {
    const objectId = typeof userId === 'string' 
      ? global.mongoose.Types.ObjectId(userId) 
      : userId;
    
    const currentDate = new Date();
    
    const results = await this.app.service('operations').Model.aggregate([
      { $match: { objectId, status: 1 } },
      {
        $project: {
          createdAt: 1,
          kind: { $ifNull: ['$kind', 0] },
          scores: 1,
          accrual: {
            $cond: {
              if: { $lte: [{ $ifNull: ["$validAt", currentDate] }, currentDate] },
              then: { $ifNull: ["$accrual", 0] },
              else: 0
            }
          }
        }
      },
      {
        $project: {
          kind: 1,
          amount: { $add: ["$accrual", "$scores"] }
        }
      },
      { $group: { _id: '$kind', amount: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
    ]);

    let listScores = [];
    let scores = 0;

    results.forEach(res => {
      const amount = Math.round(res.amount * 100) / 100;
      listScores.push({ kind: res._id, scores: amount });
      scores += amount;
    });

    listScores = listScores.filter(item => item.scores);
    
    console.log('calcScores', userId, listScores);
    return this.app.service('users').patch(objectId, { scores, listScores });
  }

  /**
   * Получить пользователя по токену или карте
   */
  async getUserFromToken(code) {
    const serviceName = code.length === 6 ? 'tokens' : 'cards';
    const service = this.app.service(serviceName);
    
    const response = await service.find({ query: { code } });
    const results = response.data || response;
    
    if (!results.length) {
      throw { 
        errorCode: code.length === 6 ? 'tokenNotFound' : 'cardNotFound', 
        message: 'Пользователь не найден' 
      };
    }
    
    const token = results[0];
    
    if (serviceName === 'cards' && token.blocked) {
      throw { errorCode: 'CardIsBlocked', message: 'Карта заблокирована' };
    }
    
    const user = await this.calcScores(token.userId);
    
    if (!user.isEnabled) {
      throw { errorCode: 'UserIsBlocked', message: 'Пользователь заблокирован' };
    }
    
    return user;
  }

  /**
   * Получить пользователя по телефону
   */
  async getUserFromPhone(phone) {
    const response = await this.app.service('users').find({ query: { phone } });
    const results = response.data || response;
    
    if (!results.length) {
      throw { errorCode: 'phoneNotFound', message: 'Пользователь не найден' };
    }
    
    const user = results[0];
    return await this.calcScores(user._id);
  }

  /**
   * Проверить истекшие бонусы
   */
  async checkExpired(action) {
    console.log('checkExpired: ' + action);
    
    const currentDate = new Date();
    let dategte, datelte, ext = {};

    if (action === 'writeOff') {
      datelte = currentDate;
      ext = {};
    } else if (action === 'sendSMS') {
      dategte = addDays(currentDate, 10, 'begin');
      datelte = addDays(currentDate, 10, 'end');
      ext = { $gte: dategte };
    } else {
      return false;
    }

    let expiredAt = { $exists: true, $ne: null, $lte: datelte };
    Object.assign(expiredAt, ext);
    
    const model = this.app.service('operations').Model;
    const operations = await model.aggregate([
      { 
        $match: { 
          expiredAt, 
          $or: [{ expired: { $exists: false } }, { expired: false }], 
          status: 1, 
          type: { $in: [1, 4] } 
        } 
      },
      { $lookup: { from: "users", localField: "objectId", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      {
        $project: {
          userId: "$userId",
          objectId: "$objectId",
          expiredAt: "$expiredAt",
          surname: "$user.surname",
          name: "$user.name",
          patronymic: "$user.patronymic",
          phone: "$user.phone",
          createdAt: "$createdAt",
          accrual: "$accrual",
          kind: { $ifNull: ['$kind', 0] }
        }
      }
    ]);

    for (const operation of operations) {
      const [results1, results2] = await Promise.all([
        model.aggregate([
          { $addFields: { kind: { $ifNull: ["$kind", 0] } } },
          { $match: { userId: operation.userId, status: 1, createdAt: { $lte: operation.createdAt }, kind: operation.kind } },
          { $project: { scores: { $sum: ['$scores', '$accrual'] } } },
          { $group: { _id: 0, scores: { $sum: '$scores' } } }
        ]),
        model.aggregate([
          { $addFields: { kind: { $ifNull: ["$kind", 0] } } },
          { $match: { userId: operation.userId, status: 1, createdAt: { $gt: operation.createdAt }, kind: operation.kind } },
          { $group: { _id: 0, scores: { $sum: '$scores' } } }
        ])
      ]);

      const scores1 = results1.length ? Math.round(results1[0].scores * 100) / 100 : 0;
      const scores2 = results2.length ? Math.round(results2[0].scores * 100) / 100 : 0;
      let delta = Math.round((scores1 + scores2) * 100) / 100;
      delta = delta > operation.accrual ? operation.accrual : delta < 0 ? 0 : delta;
      
      console.log(operation.name + ' accrual: ' + operation.accrual + 
                  ' scores1: ' + scores1 + ' scores2: ' + scores2 + ' delta: ' + delta);
      
      if (action === 'sendSMS' && delta > 150) {
        const textsms = "U vas " + getLocalDate(operation.expiredAt) + 
                       " istekaet srok deistvia " + delta + 
                       " bonusov Bayanay Club. Uspevaite ispolzovat bonus ot Bayanay Center";
        sms(operation.phone, textsms);
        console.log('SMS sent: ' + operation.phone + ' - ' + textsms);
      }
      
      if (action === 'writeOff') {
        if (delta > 0) {
          await this.app.service('operations').create({ 
            userId: operation.userId, 
            objectId: operation.objectId, 
            scores: -delta, 
            type: 2 
          });
        }
        await this.app.service('operations').patch(operation._id, { expired: true });
      }
    }

    return true;
  }
}

module.exports = BonusService;

