/**
 * Статистические эндпоинты
 */

const { startday, endday, parseDate, formatDate } = require('../utils/date-helpers');

/**
 * Получить массив статистики по датам
 */
async function getStats(results, start, end) {
  let date = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  end = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  
  const stats = await results.reduce((prev, result) => {
    const currentDate = parseDate(result._id);
    if (date < currentDate) {
      for (let d = date; d < currentDate; d.setDate(d.getDate() + 1)) {
        prev.push(0);
      }
    }
    date.setDate(currentDate.getDate() + 1);
    prev.push(result.count);
    return prev;
  }, []);
  
  if (date <= end) {
    for (let d = date; d <= end; d.setDate(d.getDate() + 1)) {
      stats.push(0);
    }
  }
  return stats;
}

/**
 * Получить категории дат
 */
function getCategories(start, end) {
  let date = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  end = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const categories = [];
  for (let d = date; d <= end; d.setDate(d.getDate() + 1)) {
    categories.push(new Date(d.valueOf()));
  }
  return categories;
}

module.exports = function(app) {
  
  /**
   * Статистика бонусов
   */
  app.use('/bonuses', {
    find() {
      return app.service('users').Model.aggregate([
        { $match: { isEnabled: true } },
        { $project: { scores: 1, count: { $add: 1 } } },
        { $group: { _id: 0, bonuses: { $sum: "$scores" }, count: { $sum: "$count" } } }
      ]);
    }
  });

  /**
   * Статистика покупок
   */
  app.use('/purchase', {
    find() {
      return app.service('operations').Model.aggregate([
        { $match: { status: 1, total: { $exists: true }, type: 1 } },
        { 
          $group: { 
            _id: 0, 
            accrual: { $sum: "$accrual" }, 
            scores: { $sum: "$scores" }, 
            cert: { $sum: "$cert" }, 
            cash: { $sum: "$cash" }, 
            total: { $sum: "$total" } 
          } 
        }
      ]);
    }
  });

  /**
   * Статистика операций
   */
  app.use('/statoperations', {
    async find(hook) {
      const query = Object.assign({ status: 1, type: 1 }, hook.query);
      console.log('statoperations', query);
      
      if (query.createdAt) query.createdAt.$gte = startday(query.createdAt.$gte);
      if (query.createdAt) query.createdAt.$lte = endday(query.createdAt.$lte);
      
      const [summary, series] = await Promise.all([
        app.service('operations').Model.aggregate([
          { $match: query },
          { 
            $group: { 
              _id: 0, 
              accrual: { $sum: "$accrual" }, 
              scores: { $sum: "$scores" }, 
              cert: { $sum: "$cert" }, 
              cash: { $sum: "$cash" }, 
              total: { $sum: "$total" } 
            } 
          }
        ]).then(results => {
          results[0].scores = -results[0].scores;
          delete results[0]._id;
          return results[0];
        }),
        app.service('operations').Model.aggregate([
          { $match: query },
          {
            $project: {
              date: { $dateToString: { format: "%Y.%m.%d", date: "$createdAt" } },
              count: { $add: 1 }
            }
          },
          { $group: { _id: "$date", count: { $sum: "$count" } } },
          { $sort: { _id: 1 } }
        ]).then(results => getStats(results, query.createdAt.$gte, query.createdAt.$lte))
      ]);
      
      const categories = getCategories(query.createdAt.$gte, query.createdAt.$lte);
      return Promise.resolve({ summary, series, categories });
    }
  });

  /**
   * Статистика клиентов
   */
  app.use('/statclients', {
    async find(hook) {
      let query = Object.assign({ isEnabled: true }, hook.query);
      console.log('statclients', query);
      
      if (query.createdAt) query.createdAt.$gte = startday(query.createdAt.$gte);
      if (query.createdAt) query.createdAt.$lte = endday(query.createdAt.$lte);
      
      const [summary, series] = await Promise.all([
        app.service('users').Model.aggregate([
          { $match: query },
          { 
            $project: { 
              scores: 1, 
              count: { $add: 1 }, 
              age: { $divide: [{ $subtract: [new Date(), "$birthDate"] }, (1000 * 60 * 60 * 24 * 365)] } 
            } 
          },
          { 
            $group: { 
              _id: 0, 
              bonuses: { $sum: "$scores" }, 
              count: { $sum: "$count" }, 
              age: { $avg: "$age" } 
            } 
          },
          { $project: { bonuses: 1, count: 1, age: 1 } }
        ]).then(results => results[0]),
        app.service('users').Model.aggregate([
          { $match: query },
          { $project: { date: { $dateToString: { format: "%Y.%m.%d", date: "$createdAt" } }, count: { $add: 1 } } },
          { $group: { _id: "$date", count: { $sum: "$count" } } },
          { $sort: { _id: 1 } }
        ]).then(results => getStats(results, query.createdAt.$gte, query.createdAt.$lte)),
      ]);
      
      const categories = getCategories(query.createdAt.$gte, query.createdAt.$lte);
      return Promise.resolve({ summary, series, categories });
    }
  });

  /**
   * Статистика сертификатов
   */
  app.use('/statcertificates', {
    async find(hook) {
      let query = Object.assign({ soldAt: { $exists: true } }, hook.query);
      console.log('statcertificates', query);
      
      if (query.soldAt) query.soldAt.$gte = startday(query.soldAt.$gte);
      if (query.soldAt) query.soldAt.$lte = endday(query.soldAt.$lte);
      
      const [summary, series, series2] = await Promise.all([
        app.service('certificates').Model.aggregate([
          { $match: query },
          {
            $project: {
              price: 1,
              count: { $add: 1 },
              canceledCount: { $add: { $cond: { if: { $eq: ["$canceled", true] }, then: 1, else: 0 } } },
              canceledSum: { $add: { $cond: { if: { $eq: ["$canceled", true] }, then: "$price", else: 0 } } },
            }
          },
          { 
            $group: { 
              _id: 0, 
              soldSum: { $sum: "$price" }, 
              soldCount: { $sum: "$count" }, 
              canceledSum: { $sum: "$canceledSum" }, 
              canceledCount: { $sum: "$canceledCount" } 
            } 
          }
        ]).then(results => {
          delete results[0]._id;
          return results[0];
        }),
        app.service('certificates').Model.aggregate([
          { $match: query },
          { $project: { date: { $dateToString: { format: "%Y.%m.%d", date: "$soldAt" } }, count: { $add: 1 } } },
          { $group: { _id: "$date", count: { $sum: "$count" } } },
          { $sort: { _id: 1 } }
        ]).then(results => getStats(results, query.soldAt.$gte, query.soldAt.$lte)),
        app.service('certificates').Model.aggregate([
          { $match: Object.assign({}, query, { canceled: true }) },
          { $project: { date: { $dateToString: { format: "%Y.%m.%d", date: "$soldAt" } }, count: { $add: 1 } } },
          { $group: { _id: "$date", count: { $sum: "$count" } } },
          { $sort: { _id: 1 } }
        ]).then(results => getStats(results, query.soldAt.$gte, query.soldAt.$lte)),
      ]);
      
      return Promise.resolve({ summary, series, series2, data: [] });
    }
  });

  /**
   * Статистика электронных сертификатов
   */
  app.use('/statelcerts', {
    async find(hook) {
      let query = Object.assign({ soldAt: { $exists: true } }, hook.query);
      console.log('statelcerts', query);
      
      if (query.soldAt) query.soldAt.$gte = startday(query.soldAt.$gte);
      if (query.soldAt) query.soldAt.$lte = endday(query.soldAt.$lte);
      
      const [summary, series, series2] = await Promise.all([
        app.service('elcerts').Model.aggregate([
          { $match: query },
          {
            $project: {
              price: 1,
              count: { $add: 1 },
              canceledCount: { $add: { $cond: { if: { $eq: ["$canceled", true] }, then: 1, else: 0 } } },
              canceledSum: { $add: { $cond: { if: { $eq: ["$canceled", true] }, then: "$price", else: 0 } } },
            }
          },
          { 
            $group: { 
              _id: 0, 
              soldSum: { $sum: "$price" }, 
              soldCount: { $sum: "$count" }, 
              canceledSum: { $sum: "$canceledSum" }, 
              canceledCount: { $sum: "$canceledCount" } 
            } 
          }
        ]).then(results => {
          if (results.length) {
            delete results[0]._id;
            return results[0];
          } else {
            return [];
          }
        }).catch(error => {
          console.log("error", error);
          return [];
        }),
        app.service('elcerts').Model.aggregate([
          { $match: query },
          { $project: { date: { $dateToString: { format: "%Y.%m.%d", date: "$soldAt" } }, count: { $add: 1 } } },
          { $group: { _id: "$date", count: { $sum: "$count" } } },
          { $sort: { _id: 1 } }
        ]).then(results => getStats(results, query.soldAt.$gte, query.soldAt.$lte)),
        app.service('elcerts').Model.aggregate([
          { $match: Object.assign({}, query, { canceled: true }) },
          { $project: { date: { $dateToString: { format: "%Y.%m.%d", date: "$soldAt" } }, count: { $add: 1 } } },
          { $group: { _id: "$date", count: { $sum: "$count" } } },
          { $sort: { _id: 1 } }
        ]).then(results => getStats(results, query.soldAt.$gte, query.soldAt.$lte)),
      ]);
      
      return Promise.resolve({ summary, series, series2, data: [] });
    }
  });

  /**
   * Рейтинги пользователей
   */
  app.use('/ratings', {
    async find(hook) {
      const query = { status: 1, type: 1, $or: [{ cert: { $exists: false } }, { cert: 0 }] };
      const limit = Number(hook.query['$limit']);
      const skip = Number(hook.query['$skip']);
      const sort = hook.query['$sort'];
      
      for (const i in sort) {
        sort[i] = Number(sort[i]);
      }
      
      console.log('ratings', hook.query);
      
      const [data, total] = await Promise.all([
        app.service('operations').Model.aggregate([
          { $match: query },
          { $lookup: { from: "users", localField: "objectId", foreignField: "_id", as: "user" } },
          { $unwind: "$user" },
          { $project: { objectId: 1, scores: 1, cash: 1, accrual: 1, total: 1, isEnabled: "$user.isEnabled", count: { $add: 1 } } },
          { $match: { isEnabled: true } },
          {
            $group: {
              _id: "$objectId", 
              scores: { $sum: "$scores" }, 
              cash: { $sum: "$cash" }, 
              accrual: { $sum: "$accrual" }, 
              total: { $sum: "$total" }, 
              count: { $sum: "$count" }
            }
          },
          { $project: { _id: "$_id", scores: 1, cash: 1, accrual: 1, total: 1, count: 1 } },
          { $sort: sort },
          { $skip: skip },
          { $limit: limit }
        ]),
        app.service('operations').Model.aggregate([
          { $match: query },
          { $group: { _id: "$objectId" } },
          { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
          { $unwind: "$user" },
          { $project: { _id: 1, isEnabled: "$user.isEnabled" } },
          { $match: { isEnabled: true } },
          { $project: { _id: 1, total: { $add: 1 } } },
          { $group: { _id: null, total: { $sum: "$total" } } }
        ]).then(res => res[0].total)
      ]);
      
      console.log('total', total);
      return { total, limit, skip, data };
    }
  });
};

