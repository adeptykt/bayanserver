const authentication = require('@feathersjs/authentication')
const errors = require('@feathersjs/errors')
const jwt = require('@feathersjs/authentication-jwt')
const local = require('@feathersjs/authentication-local')
const _ = require('lodash')
const sendElcert = require('./utils/send-elcert')

const { sms } = require('./utils/sms')

const cron = require('node-cron')

const Verifier = local.Verifier

function ucFirst(str) {
  // только пустая строка в логическом контексте даст false
  if (!str) return str

  return (str[0].toUpperCase() + str.slice(1).toLowerCase()).trim()
}

function two(s) { return ("0" + s).slice(-2) }

function addDays(date, days, type = '') {
  let d = new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
  if (type === 'end') return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59)
  if (type === 'begin') return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0)
  return d
}

function getLocalDate(d) {
  return d.getDate() + "." + two(d.getMonth() + 1) + "." + two(d.getFullYear())
}

function toJSONLocal(date) {
  var d = new Date(date)
  //d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.getDate() + "." + two(d.getMonth()+1) + "." + two(d.getFullYear()) + " " + two(d.getHours()) + ":" + two(d.getMinutes()) + ":" + two(d.getSeconds())
  //return d.toJSON() //.slice(0, 10)
}

module.exports = function () {
  const app = this
  const config = app.get('authentication')

  class CodeVerifier extends Verifier {
    verify(req, phone, code, done) {
      app.service('codes').find({ query: {phone} }).then(function(response) {
        console.log('CodeVerifier');
        var results = response.data || response
        if (!results.length) {
          done(null, false, { message: 'Телефон не зарегистрирован' })
        } else {
          var codeModel = results[0]
          if (codeModel.code === code) {
            app.service('codes').remove(codeModel._id)
            app.service('users').find({ query: {phone} }).then(function(response) {
              var results = response.data || response
              if (!results.length) {
                // todo создаем пользователя.
                app.service('users').create({phone}).then(user => user)
                .catch(error => res.send({ errorCode: 'userCreateError', message: error.message }))
              } else {
                var user = results[0]
              }
              // var payload = {userId: user._id, role: user.role}
              var payload = {}
              done(null, user, payload)
            })
          } else {
            return done(null, false, { message: 'Неправильный код' })
          }
        }
      })
    }
  }

  // Set up authentication with the secret
  app.configure(authentication(config))
  app.configure(jwt())
  app.configure(local(config.local))
  app.configure(local(Object.assign(config.mobile, {Verifier: CodeVerifier})))

  // app.use('/code', {
  //   get(phone) {
  //     app.service('users').find({ query: {phone} }).then(function(response) {
  //       var results = response.data || response
  //       let code = '1234'
  //       if (!results.length) {
  //         console.log('code: create')
  //         let userData = {phone, code}
  //         app.service('users').create(userData).then((result) => {user = result})
  //       } else {
  //         user = results[0]
  //         app.service('users').patch(user._id, {code}).then((result) => {})
  //         console.log('code: ' + JSON.stringify(user))
  //       }
  //     })
  //     return Promise.resolve({code: '1234'})
  //   }
  // })

  // app.use('/purchase', function(req, res, next) {
  //   console.log(JSON.stringify(req.query))
  //   res.send('ok')
  //   // next()
  // })

  function apikeyVerify(req, res, next) {
    const apikey = "RW9uRHkzSGxhV3pZT10xaE1fbHBEJnFSMElsM0hwOmN2VnZiZTopVl5bQDg3Jj14Kms="
    if (req.header('x-api-key') === apikey) {
      next()
    } else {
      res.send({errorCode: 1, message: 'Apikey incorrect'})
    }
    console.log('apikeyVerify: ' + req.originalUrl)
  }

  app.get('/v1/partner/company', apikeyVerify, function (req, res, next) {
    // console.log('company: ' + util.inspect(req.headers, false, null))
    res.send({MarketingSettings: {maxScoresDiscount: 50}})
  })

  app.get('/v1/partner/elcert', apikeyVerify, function (req, res, next) {
    if (!req.query.number) res.send({ errorCode: 'NumberNotExists', message: 'Нет номера сертификата' })
    else app.service('elcerts').find({ query: { number: req.query.number } }).then(response => {
      var results = response.data || response
      if (!results.length) {
        res.send({ errorCode: 'CertNotFound', message: 'Сертификат не найден' })
      } else {
        res.send(results[0])
      }
    }).catch(error => res.send({ errorCode: 'errorMongo', message: error }))
  })

  function calcScores(userId) {
      let currentDate = new Date()
      return app.service('operations').Model.aggregate([
        { $match: { userId, status: 1, $or: [ { validAt: { $exists: true, $lt: currentDate } }, { validAt: { $exists: false } } ] } },
        { $group: { _id: 0, scores: { $sum: '$scores' }, accrual: { $sum: '$accrual' } } }
      ]).then(results => {
        let scores = results.length > 0 ? Math.round((results[0].scores+results[0].accrual)*100)/100 : 0
        return app.service('users').patch(userId, { scores })
      })
  }

  function getUserFromToken(code) {
    return new Promise((resolve, reject) => {
      let serviceName = code.length == 6 ? 'tokens' : 'cards'
      let service = app.service(serviceName)
      service.find({ query: {code} }).then(response => {
        var results = response.data || response
        if (!results.length) {
          reject({ errorCode: code.length == 6 ? 'tokenNotFound' : 'cardNotFound', message: 'Пользователь не найден' })
        } else {
          token = results[0]
          if (serviceName === 'cards' && token.blocked) return reject({ errorCode: 'CardIsBlocked', message: 'Карта заблокирована' })
          let user = calcScores(token.userId).then(user => {
          // console.log('user', user);
          // app.service('users').get(token.userId).then(user => {
            if (!user.isEnabled) return reject({ errorCode: 'UserIsBlocked', message: 'Пользователь заблокирован' })
            resolve(user)
          }).catch(error => {
            reject({ errorCode: 3, message: error.message })
          })
          // console.log('code: ' + JSON.stringify(user))
        }
      })
    })
  }

  function getUserFromPhone(phone) {
    return new Promise((resolve, reject) => {
      app.service('users').find({ query: {phone} }).then(async (response) => {
        var results = response.data || response
        if (!results.length) {
          reject({errorCode: 'phoneNotFound', message: 'Пользователь не найден'})
        } else {
          let user = results[0]
          user = await calcScores(user._id)
          resolve(user)
        }
      })
    })
  }

  app.get('/v1/partner/customer', apikeyVerify, function (req, res, next) {
    if (req.query.phone) getUserFromPhone(req.query.phone).then(user => res.send(user)).catch(error => res.send(error))
    else getUserFromToken(req.query.code).then(user => res.send(user)).catch(error => res.send(error))
  })

  app.get('/v1/partner/user', apikeyVerify, function (req, res, next) {
    console.log('/v1/partner/user: ' + req.query.id)
    app.service('users').get(req.query.id).then(user => res.send(user)).catch(error => res.send(error))
  })

  app.get('/v1/partner/users', apikeyVerify, function (req, res, next) {
    console.log('/v1/partner/users: ' + req.query.scoresgt)
    // console.log('/v1/partner/users: ' + util.inspect(req.query, false, null))
    app.service('users').Model.find(
      { scores: {$gt: req.query.scoresgt, $lt: req.query.scoreslt}, isEnabled: true },
      { name: 1, surname: 1, patronymic: 1, scores: 1 }
    ).then(function(results) {
      res.send(results)
    })
  })

  app.post('/v1/partner/birthdays', apikeyVerify, function (req, res, next) {
    console.log('/v1/partner/birthdays!')
    let accrual = 500
    let monthgte = parseInt(req.query.dategte.substr(5, 2))
    let daygte = parseInt(req.query.dategte.substr(8, 2))
    let monthlte = parseInt(req.query.datelte.substr(5, 2))
    let daylte = parseInt(req.query.datelte.substr(8, 2))
    let matches = req.body.text.match(/\$\{\w+\}/)
    let projection = { _id: 1, name: 1, surname: 1, patronymic: 1, scores: 1, phone: 1, isEnabled: 1, birthDate: 1, month: { $month: "$birthDate" }, day: { $dayOfMonth: "$birthDate" } }
    if (matches) matches.forEach(match => { projection[match.slice(2, -1)] = 1 })
    app.service('users').Model.aggregate([
      { $project: projection },
      { $match: { month: { $gte: monthgte, $lte: monthlte }, day: { $gte: daygte, $lte: daylte }, isEnabled: true } },
    ]).exec((error, results) => {
      if (results) {
        let expiredAt = new Date()
        expiredAt = new Date(expiredAt.getFullYear(), expiredAt.getMonth(), expiredAt.getDate() + 20, 23, 59, 59)
        results.forEach(user => {
          let textsms = req.body.text.replace(/\$\{\w+\}/, str => {
            return user[str.slice(2, -1)]
          })
          Object.assign(user, { textsms, expiredAt })
          let newOperation = {
            userId: user._id,
            objectId: user._id,
            type: 4,
            scores: 0,
            accrual,
            expiredAt
          }
          if (req.body.action === "sendSMS") {
            app.service('operations').create(newOperation).then(operationPayment => {
              app.service('notifications').create({ userId: user._id, message: `Начислено ${accrual} промо бонусов` })
              sms(user.phone, textsms)
            })
          }
          return user
        })
        console.log('/v1/partner/birthdays: ', results[0])
        res.send(results)
      } else {
        console.log(error)
        res.send(error)
      }
    })
    //app.service('users').Model.find({ scores: { $gt: req.body.scoresgt, $lt: req.body.scoreslt }, isEnabled: true }, projection).then(function (results) {
    //  for (var i in results) {
    //    let user = results[i]
    //    let textsms = req.body.text.replace(/\$\{\w+\}/, str => {
    //      return user[str.slice(2, -1)]
    //    })
    //    if (req.body.action === "sendSMS") sms(user.phone, textsms)
    //    results[i] = Object.assign({ textsms }, { name: user.name, surname: user.surname, patronymic: user.patronymic, scores: user.scores, phone: user.phone })
    //  }
    //  if (req.body.action === "sendSMS") app.service('users').Model.update({ scores: { $gt: req.body.scoresgt, $lt: req.body.scoreslt } }, { $addToSet: { group: req.body.group } }, { multi: true }).then(result => { })
    //  res.send(results)
    //})
  })

  app.use('/v1/partner/operations', async function (req, res, next) {
    console.log('/v1/partner/operations: ' + req.query.userId)
    let query = { type: 1 }
    let userIds = []
    let userarray = {}
    let usernames = {}
    // if (req.query.store) Object.assign(users)
    if (req.query.dategte) {
      let monthgte = parseInt(req.query.dategte.substr(5, 2))
      let daygte = parseInt(req.query.dategte.substr(8, 2))
      let monthlte = parseInt(req.query.datelte.substr(5, 2))
      let daylte = parseInt(req.query.datelte.substr(8, 2))
      let projection = { _id: 1, name: 1, surname: 1, patronymic: 1, scores: 1, isEnabled: 1, month: { $month: "$birthDate" }, day: { $dayOfMonth: "$birthDate" } }
      users = await app.service('users').Model.aggregate([
        { $project: projection },
        { $match: { month: { $gte: monthgte, $lte: monthlte }, day: { $gte: daygte, $lte: daylte }, isEnabled: true } },
      ])
    } else {
      let usersQuery = {}
      if (req.query.userId) Object.assign(usersQuery, { _id: req.query.userId })
      if (req.query.isEnabled) Object.assign(usersQuery, { isEnabled: req.query.isEnabled })
      if (req.query.group) Object.assign(usersQuery, { group: req.query.group })
      users = await app.service('users').Model.find(usersQuery, { _id: 1, surname: 1, name: 1, patronymic: 1, scores: 1, isEnabled: 1 })
    }
    users.forEach(user => {
      userarray[user._id] = user.scores
      usernames[user._id] = `${user.surname} ${user.name} ${user.patronymic}`
      userIds.push(user._id.toString())
    })
    if (req.query.date) query = Object.assign(query, {createdAt: {$gt: req.query.date}})
    query = Object.assign(query, {userId: {$in: userIds}})

    app.service('operations').Model.find(query, { invoiceNumber: 1, total: 1, scores: 1, cash: 1, accrual: 1, createdAt: 1, userId: 1 })
      .then(operations => {
        let results = []
        operations.forEach(operation => {
          let rest = userarray[operation.userId]
          results.push({
            invoiceNumber: operation.invoiceNumber,
            total: operation.total,
            scores: -operation.scores,
            cash: operation.cash,
            accrual: operation.accrual,
            createdAt: operation.createdAt,
            username: usernames[operation.userId],
            rest: rest,
            userId: operation.userId
          })
        }
      )
      res.send(results)
    })
  })

  app.post('/v1/partner/sms', apikeyVerify, function (req, res, next) {
    console.log('/v1/partner/sms: ' + req.body.text)
    // console.log('/v1/partner/users: ' + util.inspect(req.query, false, null))
    let matches = req.body.text.match(/\$\{\w+\}/ )
    let projection = { name: 1, surname: 1, patronymic: 1, scores: 1, phone: 1 }
    matches.forEach(match => { projection[match.slice(2, -1)] = 1 })
    app.service('users').Model.find({ scores: {$gt: req.body.scoresgt, $lt: req.body.scoreslt}, isEnabled: true }, projection).then(function(results) {
      for (var i in results) {
      // results.forEach(user => {
        let user = results[i]
        let textsms = req.body.text.replace(/\$\{\w+\}/, str => {
          return user[str.slice(2, -1)]
        })
        if (req.body.action === "sendSMS") sms(user.phone, textsms)
        results[i] = Object.assign({textsms}, {name: user.name, surname: user.surname, patronymic: user.patronymic, scores: user.scores, phone: user.phone})
      }
      if (req.body.action === "sendSMS") app.service('users').Model.update({ scores: {$gt: req.body.scoresgt, $lt: req.body.scoreslt} }, { $addToSet: { group: req.body.group } }, { multi: true }).then(result => {})
      // app.service('users').Model.update({ scores: {$lte: req.body.scores} }, { $set: {sms: false} }, { multi: true }).then(result => {
      //   app.service('users').Model.update({ scores: {$gt: req.body.scores} }, { $set: {sms: true} }, { multi: true }).then(result => {})
      // }).catch(error => console.log(error))
      res.send(results)
    })
  })

  app.post('/v1/partner/expired', apikeyVerify, function (req, res, next) {
    let d = new Date(req.query.dategte)
    d = d.getTime() + (d.getTimezoneOffset() * 60000)
    let dategte = new Date(d)
    let datelte = new Date(req.query.datelte)
    console.log('/v1/partner/expired: ' + datelte)
    //let matches = req.body.text.match(/\$\{\w+\}/)
    //matches.forEach(match => { projection[match.slice(2, -1)] = 1 })
    let query = { status: 1, type: 1, expiredAt: { $lte: datelte, $gte: dategte }, scores: {$gt: 150} }
    app.service('operations').Model.aggregate([
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
    ]).exec((error, results) => {
      console.log('todo')
      results.map(result => {
        let textsms = req.body.text
        return Object.assign(result, { textsms } )
      })
      res.send(results)
    })
    //app.service('users').Model.find({ scores: { $gt: req.body.scoresgt, $lt: req.body.scoreslt }, isEnabled: true }, projection).then(function (results) {
    //  for (var i in results) {
    //    // results.forEach(user => {
    //    let user = results[i]
    //    let textsms = req.body.text.replace(/\$\{\w+\}/, str => {
    //      return user[str.slice(2, -1)]
    //    })
    //    if (req.body.action === "sendSMS") sms(user.phone, textsms)
    //    results[i] = Object.assign({ textsms }, { name: user.name, surname: user.surname, patronymic: user.patronymic, scores: user.scores, phone: user.phone })
    //  }
    //  res.send(results)
    //})
  })

  app.post('/v1/partner/purchase', apikeyVerify, function (req, res) {
    // console.log('total: ' + req.body.total)
    console.log('/v1/partner/purchase: ', req.body)
    getUserFromToken(req.body.code).then(user => {
      const createdAt = req.body.createdAt ? new Date(req.body.createdAt) : new Date
      const validAt = addDays(createdAt, 15, 'begin')
      const expiredAt = addDays(validAt, 365, 'end')
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
        createdAt,
        validAt,
        expiredAt
      }
      app.service('operations').create(newOperation).then(operation => {
        if (req.body.scores > 0) app.service('notifications').create({ userId: user._id, title: 'Байанай клуб', message: `${req.body.scores} баллов реализовано` })
        res.send({ operation })
      })
    }).catch(error => {
      console.log('error purchase', error)
      res.send(error)
    })
  })

  app.post('/v1/partner/revert', apikeyVerify, function (req, res) {
    console.log('/v1/partner/revert: ', req.body)
    app.service('operations').patch(req.body.id, { status: 2, expired: true }).then(operation => res.send({ operation }) )
    // app.service('operations').get(req.body.id).then(operation => {
    //   let newOperation = {
    //     userId: operation.userId,
    //     objectId: operation.objectId,
    //     type: 3,
    //     scores: -operation.scores,
    //     cert: -operation.cert,
    //     cash: -operation.cash,
    //     total: -operation.total,
    //     accrual: -operation.accrual,
    //     invoiceNumber: req.body.invoiceNumber
    //   }
    //   app.service('operations').patch(req.body.id, { expired: true })
    //   app.service('operations').create(newOperation).then(operation => res.send({ operation }))
    // }).catch(error => res.send(error))
  })

  app.post('/v1/partner/purchasepatch', apikeyVerify, function (req, res) {
    console.log('/v1/partner/purchasepatch')
    app.service('operations').patch(req.body.id, { scores: -req.body.scores, cert: req.body.cert, cash: req.body.cash, total: req.body.total }).then(operation => res.send({ operation }) )
    //app.service('operations').patch(req.body.id, { cert: req.body.cert }).then(operation => res.send({ operation }))
  })

  app.post('/v1/partner/card', apikeyVerify, function (req, res) {
    // let userData = {phone: req.body.phone, name: req.body.name, surname: req.body.surname, patrono}
    app.service('cards').find({ query: {code: req.body.code} }).then(function(response) {
      var results = response.data || response
      if (!results.length) {
        let password = (Array(6).join("0") +  Math.round(Math.random() * 999999)).slice(-6)
        let userData = Object.assign(_.omit(req.body, 'code'), {password, card: req.body.code})
        app.service('users').create(userData).then(user => {
        // console.log('CodeVerifier1: ' + util.inspect(response, false, null))
          let newCard = {code: req.body.code, userId: user._id}
          app.service('cards').create(newCard).then(card => {
            // sms(user.phone, `${user.name}, ваша клубная карта Байанай активирована. Подробнее bayanay.center. Логин ваш номер телефона, пароль ${password}`)
            let text = (user.name.length > 8 ? 'В' : `${user.name}, в`) + `аша карта активна. bayanay.center id ${user.phone} pass ${password}`
            sms(user.phone, text)
            res.send(card)
          }).catch(error => {
            console.log('card error: ' + error)
            res.send({ errorCode: 'userCreateError', message: error.message })
          })
        }).catch(error => {
          res.send({ errorCode: 'userCreateError', message: error.message })
        })
      } else {
        res.send({ errorCode: 'cardExists', message: 'Карта уже зарегистрирована' })
      }
    })
  })

  app.get('/v1/partner/certificate', apikeyVerify, function (req, res) {
    let number = Number(req.query.number)
    console.log('get certificate: ' + number)
    app.service('certificates').find({ query: { number } }).then(response => {
      var results = response.data || response
      if (results.length > 0) {
        let certificate = results[0]
        if (req.query.info) res.send(certificate)
        else if (certificate.blocked) res.send({ errorCode: 'certificateGetError', message: 'Сертификат заблокирован по причине: ' + certificate.reason })
        else if (certificate.canceledAt) res.send({ errorCode: 'certificateGetError', message: 'Сертификат погашен ' + toJSONLocal(certificate.canceledAt) })
        else res.send(certificate)
      } else {
        res.send({ errorCode: 'certificateGetError', message: 'Сертификат не зарегистрирован' })
      }
    })
  })

  app.post('/v1/partner/certificate', apikeyVerify, function (req, res) {
    const id = req.body._id
    delete req.body._id
    console.log('post certificate:',  req.body)
    app.service('certificates').update(id, req.body).then(response => {
      var results = response.data || response
      if (results.length > 0) {
        let certificate = results[0]
        res.send(certificate)
      }
    })
  })

  app.post('/v1/partner/certificatepatch', apikeyVerify, async (req, res) => {
    req.body.soldAt = new Date(req.body.soldAt)
    const id = req.body._id
    delete req.body._id
    console.log('certificatepatch', req.body, new Date(req.body.soldAt))
    certificate = await app.service('certificates').patch(id,
      { saleStore: req.body.saleStore, soldAt: req.body.soldAt, saleNumber: req.body.saleNumber, saleType: req.body.saleType }
    )
    console.log('Сертификат успешно ' + req.body.number + ' обновлен', certificate)
    res.send(certificate)
    //res.send({})
  })

  app.post('/v1/partner/certificates', apikeyVerify, async (req, res) => {
    console.log('certificates: ')
    let action = req.body.action, query
    let certificates = await Promise.all(req.body.certificates.map(async number => {
      let response = await app.service('certificates').find({ query: { number } })
      var results = response.data || response
      let certificate = {}, error, result = {}
      if (!results.length) {
        if (action === 'create') {
          certificate = await app.service('certificates').create({ productId: req.body.productId, store: req.body.store, sum: req.body.sum, number, price: req.body.sum })
        } else {
          error = 'Сертификат не зарегистрирован'
        }
      } else {
        certificate = results[0]
        if (action === 'create') {
          error = 'Сертификат уже зарегистрирован'
        } else {
          if (action === 'sale' && certificate.soldAt) error = 'Сертификат уже продан ' + toJSONLocal(certificate.soldAt)
          if ((action === 'sale' || action === 'cancel') && certificate.canceledAt) error = 'Сертификат погашен ' + toJSONLocal(certificate.canceledAt)
          if (!error) {
            if (action === 'sale') {
              certificate = await app.service('certificates').patch(certificate._id, { saleStore: req.body.store, soldAt: new Date, saleNumber: req.body.docNumber, saleType: req.body.docType })
            } else if (action === 'cancel') {
              await app.service('redemptions').create({ certificateId: certificate._id, store: req.body.store, docNumber: req.body.docNumber, docType: req.body.docType, sum: req.body.sum })
            }
          }
        }
      }
      if (certificate) Object.assign(result, certificate)
      if (error) Object.assign(result, { error })
      return result
    }))
    console.log('Сертификаты успешно ' + action + ': ', certificates)
    res.send(certificates)
  })

  app.post('/v2/partner/certificates', apikeyVerify, async (req, res) => {
    console.log('v2certificates2')
    let action = req.body.action, query
    let certificates = await Promise.all(req.body.certificates.map(async ({ number, sum }) => {
      let response = await app.service('certificates').find({ query: { number } })
      var results = response.data || response
      let certificate = {}, error, result = {}
      if (!results.length) {
        if (action === 'create') {
          certificate = await app.service('certificates').create({ productId: req.body.productId, store: req.body.store, sum: req.body.sum, number, price: req.body.sum })
        } else {
          error = 'Сертификат не зарегистрирован'
        }
      } else {
        certificate = results[0]
        if (action === 'create') {
          error = 'Сертификат уже зарегистрирован'
        } else {
          if (action === 'sale' && certificate.soldAt) error = 'Сертификат уже продан ' + toJSONLocal(certificate.soldAt)
          if ((action === 'sale' || action === 'cancel') && certificate.canceledAt) error = 'Сертификат погашен ' + toJSONLocal(certificate.canceledAt)
          if (!error) {
            if (action === 'sale') {
              certificate = await app.service('certificates').patch(certificate._id, { saleStore: req.body.store, soldAt: new Date, saleNumber: req.body.docNumber, saleType: req.body.docType })
            } else if (action === 'cancel') {
              await app.service('redemptions').create({ certificateId: certificate._id, store: req.body.store, docNumber: req.body.docNumber, docType: req.body.docType, sum })
            }
          }
        }
      }
      if (certificate) Object.assign(result, certificate)
      if (error) Object.assign(result, { error })
      return result
    }))
    res.send(certificates)
  })

  app.use('/push', {
    get(message) {
      app.io.emit('notification', {title: 'title', message})
      return Promise.resolve({code: 'push sent'})
    }
  })

  // app.use('/updateoperations', function (req, res, next) {
  //   console.log('updateoperations')
  //   app.service('operations').Model.find().then(function(results) {
  //     let _id
  //     results.forEach((operation, index) => {
  //       if (index % 2 === 0) {
  //         _id = operation._id
  //       } else {
  //         if (operation.type !== 3) {
  //           console.log(`${toJSONLocal(operation.createdAt)} ${operation.invoiceNumber} ${operation.scores}`)
  //           return false
  //         } else {
  //           app.service('operations').Model.update({ _id }, { $set: {accrual: operation.scores} }).then(result => {
  //           }).catch(error => console.log(error))
  //         }
  //       }
  //       return true
  //     })
  //     res.send({res: "ok"})
  //   })
  // })

  app.use('/sendmail', function (req, res, next) {
    console.log('sendmail')
    sendElcert('m135et@gmail.com', 666, 150000, 'Иванов Петр Иванович', new Date())
    res.send({})
  })

  app.use('/checkcert', function (req, res, next) {
    console.log('checkcert')
    app.service('certificates').Model.find({ sum: 0, canceled: false }).then(certificates => {
      certificates.forEach(cert => {
        console.log('Error', cert)
      })
    })
    res.send({})
  })

  app.use('/cert', function (req, res, next) {
    console.log('cert')
    let query = { status: 1, type: 1 }
    app.service('redemptions').Model.aggregate([
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
    ]).exec((error, results) => {
      results.forEach(result => {
        app.service('redemptions').patch(result._id, { sum: result.sum })
        console.log('', result)
      })
      res.send(error ? error : results)
    })
  })

  app.use('/updateoperations', function (req, res, next) {
    console.log('updateoperations')
    app.service('operations').Model.update({ cash: { $lt: 0 } }, { $set: { type: 3 } }, { multi: true }).then(result => res.send({ res: "ok" }))
    //app.service('operations').Model.find().then(function(results) {
    //  let store
    //  results.forEach((operation, index) => {
    //    if (operation.invoiceNumber) {
    //      switch(operation.invoiceNumber.slice(0, 2)) {
    //        case "ХА":
    //          store = 'hab'
    //          break
    //        case "УТ":
    //          store = 'trd'
    //          break
    //        case "ВИ":
    //          store = 'chk'
    //          break
    //        case "АВ":
    //          store = 'avt'
    //          break
    //      }
    //      app.service('operations').Model.update({ _id: operation._id }, { $set: {store} }).then(result => {
    //      }).catch(error => console.log(error))
    //    }
    //  })
    //  res.send({res: "ok"})
    //})
  })

  app.use('/clearoperations', function (req, res, next) {
    console.log('clearoperations')
    app.service('operations').Model.remove({type: 3}).then(() => {})
    res.send({res: "ok"})
  })

  app.use('/checkoperations', function (req, res, next) {
    console.log('checkoperations1: ' + req.query.store)
    // app.service('operations').Model.find({}, {userId: 1}).then(operations => {
    //   let objectId = null
    //   operations.forEach(operation => {
    //     objectId = global.mongoose.Types.ObjectId(operation.userId)
    //     app.service('operations').Model.update({_id: operation._id}, { $set: {objectId} }, { multi: true }).then(result => {})
    //   })
    // })
    // res.send('ok')
    // // ищем топ по продажам
    // let query = {status: 1, type: 1}
    // if (req.query.store) Object.assign(query, {store: req.query.store})
    // app.service('operations').Model.aggregate([
    //   {$match: query},
    //   {$project: {objectId: 1, count: {$add: [1]}}},
    //   {$group: {_id: "$objectId", count: {$sum: "$count"}}},
    //   {$sort: {count: -1}},
    //   {$limit: 10},
    //   {$lookup: {from: "users", localField: "_id", foreignField: "_id", as: "user"}},
    //   {$unwind: "$user"},
    //   {$project: {
    //     "_id": 1,
    //     "count": 1,
    //     "name": "$user.name",
    //     "surname": "$user.surname",
    //     "patronymic": "$user.patronymic",
    //     "phone": "$user.phone",
    //   }}
    // ]).exec((error, results) => {
    //   console.log('checkoperations2')
    //   results.forEach(result => {
    //     // console.log(`----${result.user[0].surname} ${result.user[0].name} ${result.user[0].patronymic}: ${result.number}`)
    //     // console.log(`----${result.userId}: ${result.number}`)
    //     console.log(util.inspect(result, false, null))
    //   })
    //   res.send(error ? error: results)
    // })

    //// ищем топ по продажам , userId: '599413e181157826ccf67b70'
    //let query = {status: 1, type: 1}
    //app.service('operations').Model.aggregate([
    //  {$match: query},
    //  {$project: {objectId: 1, count: {$add: [1]}, yearMonthDay: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }}},
    //  {$group: {_id: {objectId: "$objectId", yearMonthDay: "$yearMonthDay"}, count: {$sum: "$count"}}},
    //  {$match: {count: {$gt: 2}}},
    //  {$group: {_id: "$_id.objectId"}},
    //  {$lookup: {from: "users", localField: "_id", foreignField: "_id", as: "user"}},
    //  {$unwind: "$user"},
    //  {$project: {
    //    "_id": 1,
    //    "surname": "$user.surname",
    //    "name": "$user.name",
    //    "patronymic": "$user.patronymic",
    //    "phone": "$user.phone",
    //  }}
    //]).exec((error, results) => {
    //  console.log('checkoperations2')
    //  results.forEach(result => {
    //    // console.log(`----${result.user[0].surname} ${result.user[0].name} ${result.user[0].patronymic}: ${result.number}`)
    //    // console.log(`----${result.userId}: ${result.number}`)
    //    console.log('', result)
    //  })
    //  res.send(error ? error: results)
    //})

    app.service('operations').Model.aggregate([
      { $match: { type: 1 } },
      { $project: { diff: { $subtract: [{ $subtract: [{ $add: ["$cash", { $ifNull: ["$cert", 0] }] }, "$scores"] }, "$total"] }, total: 1, cash: 1, cert: { $ifNull: ["$cert", 0] }, scores: 1, invoiceNumber: 1 } },
      { $match: { diff: { $ne: 0 } } },
      { $limit: 10 },
    ]).exec((error, results) => {
      console.log('checkoperations2')
      if (error) console.log('error', error)
      else results.forEach(result => {
        // console.log(`----${result.user[0].surname} ${result.user[0].name} ${result.user[0].patronymic}: ${result.number}`)
        // console.log(`----${result.userId}: ${result.number}`)
        console.log('', result)
      })
      res.send(error ? error : results)
    })
  })

  app.use('/group', function (req, res, next) {
    console.log('/group: ' + req.body.text)
    // console.log('/v1/partner/users: ' + util.inspect(req.query, false, null))
    // // Добавляем группу 1
    // app.service('users').Model.update({ sms: true }, { $addToSet: { group: 1 } }, { multi: true }).then(result => {})
    // // Убираем группу 2
    // app.service('users').Model.update({}, { $pullAll: { group: [2] } }, { multi: true }).then(result => {})
    // let phones = []
    // app.service('users').Model.update({phone: {$in: phones} }, { $addToSet: { group: 2 } }, { multi: true }).then(result => {})
  })

  app.use('/expiredAt', function (req, res, next) {
    console.log('/expiredAt')
    // Вычисляем expiredAt
    let expiredAt = addDays(new Date, 183, 'end')
    console.log('expiredAt:', toJSONLocal(expiredAt))
    res.send(expiredAt)
    //app.service('operations').Model.find({ accrual: { $gt: 0 }, expiredAt: { $exists: false }, type: 1 })
    //  .then(operations => {
    //    return operations.map(doc => {
    //      //console.log('operation: ', doc)
    //      let expiredAt = new Date(doc.createdAt.valueOf() + (1000 * 60 * 60 * 24 * 183))
    //      expiredAt = new Date(expiredAt.getFullYear(), expiredAt.getMonth(), expiredAt.getDate(), 23, 59, 59)
    //      app.service('operations').Model.updateOne({ _id: doc._id }, { $set: { expiredAt } }).then(result => {})
    //      return `${toJSONLocal(doc.createdAt)} accrual: ${doc.accrual} expiredAt ${toJSONLocal(expiredAt)}`
    //    })
    //  })
    //  .then(results => res.send(results))
  })

  app.use('/checkphone', {
    find() {
      console.log('checkphone')
      app.service('users').find({ query: {phone: /^9242/} }).then(function(response) {
        var results = response.data || response
        if (!results.length) {
          return Promise.resolve({message: 'Users not found'})
        } else {
          results.forEach(user => {
            if (user.phone.length === 11) {
              let phone = user.phone.slice(1)
              app.service('users').patch(user._id, { phone }).then(response => {
                console.log(`${user.phone} изменен на ${response.phone}`)
              })
            } else {
              if (user.phone.length === 12) {
                console.log('Wrong number: ' + JSON.stringify(user))
              }
            }
          })
          return Promise.resolve(results)
        }
      })
    }
  })

  app.get('/v1/partner/operation', apikeyVerify, function (req, res, next) {
    console.log('/v1/partner/customer: ' + req.query.id)
    app.service('operations').get(req.query.id).then(operation => res.send(operation)).catch(error => res.send(error))
  })

  app.post('/v1/partner/operation', apikeyVerify, function (req, res, next) {
    console.log('/v1/partner/customer: ' + req.query.id)
    app.service('operations').get(req.query.id).then(operation => {
      let scores = req.query.scores
      app.service('operations').patch(req.query.id, {scores}).then(result => res.send(operation)).catch(error => res.send(error))
    }).catch(error => res.send(error))
  })

  app.use('/checkcards', function (req, res, next) {
    console.log('checkcards')
    app.service('cards').Model.find({$where: "this.code.length < 13"}).then(results => {
      results.forEach(card => {
        console.log('card: ' + card.code + ' - ' + card.createdAt)
        // app.service('users').get(card.userId).then(user => {
        //   app.service('users').patch(card.userId, { card: card.code })
        // })
      })
      res.send('ok')
    })
  })

  app.use('/checknames', function (req, res, next) {
    console.log('checknames')
    const query = /^[^А-Я]|\s$|^[А-Я].*[А-Я]/
    // app.service('users').Model.find({ query: { $or: [ { surname: /^[^А-Я]|\s$|^[А-Я].*[А-Я]/ }, { name: /^[^А-Я]|\s$|^[А-Я].*[А-Я]/ }, { patronymic: /^[^А-Я]|\s$|^[А-Я].*[А-Я]/ } ] } }).then(function(response) {
    app.service('users').Model.find({ $or: [ { surname: query }, { name: query }, { patronymic: query } ] }).then(results => {
      // var results = response.data || response
      if (!results.length) {
        return res.send('Users not found')
      } else {
        let httpList = ""
        results.forEach(user => {
          let surname = ucFirst(user.surname)
          let name = ucFirst(user.name)
          let patronymic = ucFirst(user.patronymic)
          httpList = httpList + `<div>\"${user.surname}\" \"${user.name}\" \"${user.patronymic}\" => \"${surname}\" \"${name}\" \"${patronymic}\"</div>`
          app.service('users').patch(user._id, { surname, name, patronymic })
        })
        res.send(httpList)
      }
    }).catch(error => res.send(error))
  })

  app.use('/birthday', function (req, res, next) {
    console.log('birthday')
    app.service('users').Model.find({ "birthday" : { "$exists" : false } }).then(results => {
      if (!results.length) {
        return res.send('Users not found')
      } else {
        console.log('length: ' + results.length)
        let httpList = ""
        let birthday = ""
        results.forEach(user => {
          new Promise((resolve, reject) => {
            if (!user.birthDate) {
              reject('error')
            } else {
              resolve(`${('0'+user.birthDate.getDate()).slice(-2)}-${('0'+(user.birthDate.getMonth()+1)).slice(-2)}-${user.birthDate.getFullYear()}`)
            }
          }).then(birthday => {
            console.log(`${user.surname} ${user.name} ${user.patronymic} - ${birthday}`)
            app.service('users').patch(user._id, { birthday })
          }).catch(error => {
            console.log(`----${user.surname} ${user.name} ${user.patronymic}`)
          })
          // httpList = httpList + `<div>\"${user.surname}\" \"${user.name}\" \"${user.patronymic}\" => \"${birthday}\"</div>`
          // app.service('users').patch(user._id, { birthday })
        })
        res.send(httpList)
      }
    }).catch(error => res.send(error))
  })

  app.use('/bonuses', {
    find() {
      return app.service('users').Model.aggregate([
        { $match: { isEnabled: true } },
        { $project: { scores: 1, count: { $add: 1 } } },
        { $group: { _id: 0, bonuses: { $sum: "$scores" }, count: { $sum: "$count" } } }
      ])
    }
  })

  app.use('/statcertificates3', {
    async find() {
      console.log('statcertificates')
      let [results1, results2] = await Promise.all([
        app.service('certificates').Model.aggregate([
          { $match: { soldAt: { $exists: true } } },
          { $project: { count: { $add: 1 }, price: 1 } },
          { $group: { _id: 0, sum: { $sum: "$price" }, count: { $sum: "$count" } } }
        ]),
        app.service('certificates').Model.aggregate([
          { $match: { canceled: true } },
          { $project: { count: { $add: 1 }, price: 1 } },
          { $group: { _id: 0, sum: { $sum: "$price" }, count: { $sum: "$count" } } }
        ])
      ])
      return Promise.resolve({ sold: results1[0], canceled: results2[0] })
    }
  })

  app.use('/purchase', {
    find(hook) {
      return app.service('operations').Model.aggregate([
        { $match: { status: 1, total: { $exists: true }, type: 1 } },
        { $group: { _id: 0, accrual: { $sum: "$accrual" }, scores: { $sum: "$scores" }, cert: { $sum: "$cert" }, cash: { $sum: "$cash" }, total: { $sum: "$total" } } }
      ])
    }
  })

  function isDate(date) {
    return date instanceof Date && !isNaN(date.valueOf());
  }

  function parseDate(str) {
    if (typeof str !== 'string') {
      return undefined;
    }
    var split = str.split('.');
    if (split.length !== 3) {
      return undefined;
    }
    var year = parseInt(split[0], 10);
    var month = parseInt(split[1], 10) - 1;
    var day = parseInt(split[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day) || day <= 0 || day > 31 || month < 0 || month >= 12) {
      return undefined;
    }

    return new Date(year, month, day);
  }

  function formatDate(d) {
    if (isDate(d)) {
      var year = d.getFullYear();
      var month = ('0' + (d.getMonth() + 1)).slice(-2);
      var day = ('0' + d.getDate()).slice(-2);
      return day + '.' + month + '.' + year;
    }
    return '';
  }

  function startday(date) {
    let d = new Date(date)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0)
  }

  function endday(date) {
    let d = new Date(date)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59)
  }

  getStats = async (results, start, end) => {
    let date = new Date(start.getFullYear(), start.getMonth(), start.getDate())
    end = new Date(end.getFullYear(), end.getMonth(), end.getDate())
    let stats = await results.reduce((prev, result, index, arr) => {
      const currentDate = parseDate(result._id)
      if (date < currentDate) {
        for (let d = date; d < currentDate; d.setDate(d.getDate() + 1)) prev.push(0)
      }
      date.setDate(currentDate.getDate() + 1)
      prev.push(result.count)
      return prev
    }, [])
    if (date <= end) {
      for (let d = date; d <= end; d.setDate(d.getDate() + 1)) stats.push(0)
    }
    return stats
  }

  app.use('/statoperations', {
    async find(hook) {
      let query = Object.assign({ status: 1, type: 1 }, hook.query)
      console.log('statoperations', query)
      if (query.createdAt) query.createdAt.$gte = startday(query.createdAt.$gte)
      if (query.createdAt) query.createdAt.$lte = endday(query.createdAt.$lte)
      let [summary, series] = await Promise.all([
        app.service('operations').Model.aggregate([
          { $match: query },
          { $group: { _id: 0, accrual: { $sum: "$accrual" }, scores: { $sum: "$scores" }, cert: { $sum: "$cert" }, cash: { $sum: "$cash" }, total: { $sum: "$total" } } }
        ])
          .then(results => {
            results[0].scores = -results[0].scores
            delete results[0]._id
            return results[0]
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
        ])
          .then(results => { return getStats(results, query.createdAt.$gte, query.createdAt.$lte) })
      ])
      return Promise.resolve({ summary, series })
    }
  })

  app.use('/ratings', {
    async find(hook) {
      //let query = Object.assign({ status: 1, type: 1 }, hook.query)
      const query = { status: 1, type: 1, $or: [{ cert: { $exists: false } }, { cert: 0 }] }
      const limit = Number(hook.query['$limit'])
      const skip = Number(hook.query['$skip'])
      const sort = hook.query['$sort']
      for (var i in sort) sort[i] = Number(sort[i])
      console.log('statratings', hook.query)
      let [data, total] = await Promise.all([
        app.service('operations').Model.aggregate([
          { $match: query },
          { $lookup: { from: "users", localField: "objectId", foreignField: "_id", as: "user" } },
          { $unwind: "$user" },
          { $project: { objectId: 1, scores: 1, cash: 1, accrual: 1, total: 1, isEnabled: "$user.isEnabled", count: { $add: 1 } } },
          { $match: { isEnabled: true } },
          {
            $group: {
              _id: "$objectId", scores: { $sum: "$scores" }, cash: { $sum: "$cash" }, accrual: { $sum: "$accrual" }, total: { $sum: "$total" }, count: { $sum: "$count" }
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
      ])
      console.log('total', total)
      return { total, limit, skip, data }
    }
  })

  app.use('/statclients', {
    async find(hook) {
      let query = Object.assign({ isEnabled: true }, hook.query)
      console.log('statclients', query)
      if (query.createdAt) query.createdAt.$gte = startday(query.createdAt.$gte)
      if (query.createdAt) query.createdAt.$lte = endday(query.createdAt.$lte)
      let [summary, series] = await Promise.all([
        app.service('users').Model.aggregate([
          { $match: query },
          { $project: { scores: 1, count: { $add: 1 }, age: { $divide: [{ $subtract: [new Date(), "$birthDate"] }, (1000 * 60 * 60 * 24 * 365)] } } },
          { $group: { _id: 0, bonuses: { $sum: "$scores" }, count: { $sum: "$count" }, age: { $avg: "$age" } } },
          { $project: { bonuses: 1, count: 1, age: 1 } }
        ])
          .then(results => results[0]),
        app.service('users').Model.aggregate([
          { $match: query },
          { $project: { date: { $dateToString: { format: "%Y.%m.%d", date: "$createdAt" } }, count: { $add: 1 } } },
          { $group: { _id: "$date", count: { $sum: "$count" } } },
          { $sort: { _id: 1 } }
        ])
          .then(results => getStats(results, query.createdAt.$gte, query.createdAt.$lte)),
      ])
      return Promise.resolve({ summary, series })
    }
  })

  app.use('/statcertificates', {
    async find(hook) {
      let query = Object.assign({ soldAt: { $exists: true } }, hook.query)
      console.log('statclients', query)
      if (query.soldAt) query.soldAt.$gte = startday(query.soldAt.$gte)
      if (query.soldAt) query.soldAt.$lte = endday(query.soldAt.$lte)
      let [summary, series, series2] = await Promise.all([
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
          { $group: { _id: 0, soldSum: { $sum: "$price" }, soldCount: { $sum: "$count" }, canceledSum: { $sum: "$canceledSum" }, canceledCount: { $sum: "$canceledCount" } } }
        ])
          .then(results => {
            delete results[0]._id
            return results[0]
          }),
        app.service('certificates').Model.aggregate([
          { $match: query },
          { $project: { date: { $dateToString: { format: "%Y.%m.%d", date: "$soldAt" } }, count: { $add: 1 } } },
          { $group: { _id: "$date", count: { $sum: "$count" } } },
          { $sort: { _id: 1 } }
        ])
          .then(results => { return getStats(results, query.soldAt.$gte, query.soldAt.$lte) }),
        app.service('certificates').Model.aggregate([
          { $match: Object.assign({}, query, { canceled: true }) },
          { $project: { date: { $dateToString: { format: "%Y.%m.%d", date: "$soldAt" } }, count: { $add: 1 } } },
          { $group: { _id: "$date", count: { $sum: "$count" } } },
          { $sort: { _id: 1 } }
        ])
          .then(results => { return getStats(results, query.soldAt.$gte, query.soldAt.$lte) }),
      ])
      return Promise.resolve({ summary, series, series2 })
    }
  })

  app.use('/statelcerts', {
    async find(hook) {
      let query = Object.assign({ soldAt: { $exists: true } }, hook.query)
      console.log('statelcerts', query)
      if (query.soldAt) query.soldAt.$gte = startday(query.soldAt.$gte)
      if (query.soldAt) query.soldAt.$lte = endday(query.soldAt.$lte)
      let [summary, series, series2] = await Promise.all([
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
          { $group: { _id: 0, soldSum: { $sum: "$price" }, soldCount: { $sum: "$count" }, canceledSum: { $sum: "$canceledSum" }, canceledCount: { $sum: "$canceledCount" } } }
        ])
          .then(results => {
            delete results[0]._id
            return results[0]
          }),
        app.service('elcerts').Model.aggregate([
          { $match: query },
          { $project: { date: { $dateToString: { format: "%Y.%m.%d", date: "$soldAt" } }, count: { $add: 1 } } },
          { $group: { _id: "$date", count: { $sum: "$count" } } },
          { $sort: { _id: 1 } }
        ])
          .then(results => { return getStats(results, query.soldAt.$gte, query.soldAt.$lte) }),
        app.service('elcerts').Model.aggregate([
          { $match: Object.assign({}, query, { canceled: true }) },
          { $project: { date: { $dateToString: { format: "%Y.%m.%d", date: "$soldAt" } }, count: { $add: 1 } } },
          { $group: { _id: "$date", count: { $sum: "$count" } } },
          { $sort: { _id: 1 } }
        ])
          .then(results => { return getStats(results, query.soldAt.$gte, query.soldAt.$lte) }),
      ])
      return Promise.resolve({ summary, series, series2 })
    }
  })

  async function checkExpired_(action) {
    console.log('checkExpired: ' + action)
    let currentDate = new Date()
    if (action === 'writeOff') {
      var datelte = currentDate
      var ext = {}
    } else if (action === 'sendSMS') {
      var dategte = addDays(currentDate, 8, 'begin')
      var datelte = addDays(currentDate, 8, 'end')
      var ext = { $gte: dategte }
    } else { return false }
    let expiredAt = { $exists: true, $ne: null, $lte: datelte }
    Object.assign(expiredAt, ext)
    let model = app.service('operations').Model
    let operations = await model.aggregate([
      { $match: { expiredAt, expired: { $exists: false }, status: 1, type: 1 } },
      { $lookup: { from: "users", localField: "objectId", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      {
        $project: {
          "_id": "$_id",
          "userId": "$userId",
          "objectId": "$objectId",
          "accrual": "$accrual",
          "expiredAt": "$expiredAt",
          "createdAt": "$createdAt",
          "surname": "$user.surname",
          "name": "$user.name",
          "patronymic": "$user.patronymic",
          "phone": "$user.phone",
        }
      }
    ])

    var results = '', num = 0
    for (let index = 0; index < operations.length; index++) {
      operation = operations[index]
      let [results1, results2] = await Promise.all([
        model.aggregate([
          { $match: { userId: operation.userId, status: 1, createdAt: { $lt: operation.createdAt } } },
          { $project: { scores: { $sum: ['$scores', '$accrual'] } } },
          { $group: { _id: 0, scores: { $sum: '$scores' } } }
        ]),
        model.aggregate([
          { $match: { userId: operation.userId, status: 1, createdAt: { $gt: operation.createdAt } } },
          { $group: { _id: 0, scores: { $sum: '$scores' } } }
        ])
      ])
      let scores1 = 0
      let scores2 = 0
      if (results1.length) scores1 = Math.round((results1[0].scores) * 100) / 100
      if (results2.length) scores2 = Math.round((results2[0].scores) * 100) / 100
      let delta = Math.round((operation.accrual + scores1 + scores2) * 100) / 100
      delta = delta > operation.accrual ? operation.accrual : delta < 0 ? 0 : delta
      if (action === 'sendSMS' && delta > 150) {
        let textsms = "U vas " + getLocalDate(operation.expiredAt) + " istekaet srok deistvia " + delta + " bonusov Bayanay Club.Uspevaite ispolzovat bonus ot Bayanay Center"
        //let textsms = 'Na vashem bonusnom schete ' + delta + 'r, srok ih deistvia istekaet ' + getLocalDate(operation.expiredAt) + '. Uspevaite ispolzovat bonus ot Bayanay Center'
        sms(operation.phone, textsms)
        console.log('accrual: ' + operation.accrual + ' scores1: ' + scores1 + ' scores2: ' + scores2 + ' delta: ' + delta + ' phone: ' + operation.phone + ' expiredAt: ' + toJSONLocal(operation.expiredAt) + ' - ' + textsms)
        results += '' + ++num + '. ' + operation.name + ' ' + operation.surname + ' (' + operation.phone + ') ' + delta + ' истекает ' + getLocalDate(operation.expiredAt) + '<br>'
      }
      if (action === 'writeOff' && delta > 0) {
        app.service('operations').create({ userId: operation.userId, objectId: operation.objectId, scores: -delta, type: 2 })
        app.service('operations').patch(operation._id, { expired: true })
      }
    }

    return true
  }

  async function checkExpired(action) {

    console.log('checkExpired: ' + action)
    let currentDate = new Date()

    if (action === 'writeOff') {
      var datelte = currentDate
      var ext = {}
    }
    else if (action === 'sendSMS') {
      var dategte = addDays(currentDate, 10, 'begin')
      var datelte = addDays(currentDate, 10, 'end')
      var ext = { $gte: dategte }
    }
    else { return false }

    let expiredAt = { $exists: true, $ne: null, $lte: datelte }
    Object.assign(expiredAt, ext)
    let model = app.service('operations').Model
    let operations = await model.aggregate([
      { $match: { expiredAt, $or: [{ expired: { $exists: false } }, { expired: false }], status: 1, type: 1 } },
      { $lookup: { from: "users", localField: "objectId", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      {
        $group: {
          _id: {
            userId: "$userId",
            objectId: "$objectId",
            expiredAt: "$expiredAt",
            surname: "$user.surname",
            name: "$user.name",
            patronymic: "$user.patronymic",
            phone: "$user.phone",
          },
          createdAt: { $max: "$createdAt" },
          accrual: { $sum: "$accrual" }
        }
      },
      {
        $project: {
          userId: "$_id.userId",
          objectId: "$_id.objectId",
          expiredAt: "$_id.expiredAt",
          surname: "$_id.surname",
          name: "$_id.name",
          patronymic: "$_id.patronymic",
          phone: "$_id.phone",
          createdAt: "$createdAt",
          accrual: "$accrual"
        }
      }
    ])

    for (let index = 0; index < operations.length; index++) {
      operation = operations[index]
      let [results1, results2] = await Promise.all([
        model.aggregate([
          { $match: { userId: operation.userId, status: 1, createdAt: { $lte: operation.createdAt } } },
          { $project: { scores: { $sum: ['$scores', '$accrual'] } } },
          { $group: { _id: 0, scores: { $sum: '$scores' } } }
        ]),
        model.aggregate([
          { $match: { userId: operation.userId, status: 1, createdAt: { $gt: operation.createdAt } } },
          { $group: { _id: 0, scores: { $sum: '$scores' } } }
        ])
      ])
      let scores1 = 0
      let scores2 = 0
      if (results1.length) scores1 = Math.round((results1[0].scores) * 100) / 100
      if (results2.length) scores2 = Math.round((results2[0].scores) * 100) / 100
      let delta = Math.round((scores1 + scores2) * 100) / 100
      delta = delta > operation.accrual ? operation.accrual : delta < 0 ? 0 : delta
      console.log(operation.name + ' accrual: ' + operation.accrual + ' scores1: ' + scores1 + ' scores2: ' + scores2 + ' delta: ' + delta)
      if (action === 'sendSMS' && delta > 150) {
        let textsms = "U vas " + getLocalDate(operation.expiredAt) + " istekaet srok deistvia " + delta + " bonusov Bayanay Club. Uspevaite ispolzovat bonus ot Bayanay Center"
        sms(operation.phone, textsms)
        console.log('accrual: ' + operation.accrual + ' scores1: ' + scores1 + ' scores2: ' + scores2 + ' delta: ' + delta + ' phone: ' + operation.phone + ' expiredAt: ' + toJSONLocal(operation.expiredAt) + ' - ' + textsms)
      }
      if (action === 'writeOff') {
        if (delta > 0) app.service('operations').create({ userId: operation.userId, objectId: operation.objectId, scores: -delta, type: 2 })
        app.service('operations').patch(operation._id, { expired: true })
      }
    }

    return true
  }

  // app.use('/checkexpired', (req, res, next) => {
  //  checkExpired('sendSMS')
  //  res.send('ok')
  // })

  app.use('/checkscores', (req, res, next) => {
    console.log('checkscores')
    app.service('users').find({ query: { scores: { $lt: 0 } } }).then(response => {
      var results = response.data || response
      if (results.length) {
        results.forEach(user => {
          console.log('phone: ' + user.phone + ' scores: ' + user.scores + ' id: ' + user._id)
        })
      }
    })
    res.send('ok')
  })

  app.use('/blockcertificates', (req, res, next) => {
    let gte = Number(req.query.start)
    let lte = Number(req.query.end)
    console.log('blockcertificates', gte, lte)
    app.service('certificates').Model.update({ number: { $gte: gte, $lte: lte } }, { $set: { reason: req.query.reason, blocked: true } }, { multi: true })
      .then(result => res.send('ok'))
      .catch(error => res.send('error: ' + error.message))
  })

  app.use('/unblockcertificates', (req, res, next) => {
    let gte = Number(req.query.start)
    let lte = Number(req.query.end)
    console.log('unblockcertificates', gte, lte)
    app.service('certificates').Model.update({ number: { $gte: gte, $lte: lte } }, { $set: { blocked: false } }, { multi: true })
      .then(result => res.send('ok'))
      .catch(error => res.send('error: ' + error.message))
  })

  app.use('/payment', async function (req, res, next) {
    console.log('/payment body', req.body)
    const paymentId = req.body.object.id
    const status = req.body.object.status

    const order = await app.service('orders').Model.findOne({ paymentId })
    if (!order) {
      console.log('payment ' + paymentId + ' not found');
      res.send('notfound')
      return
    }
    console.log('payment order', order);
    // можно сделать дополнительную проверку платежа
    // YandexCheckout.getPayment(paymentId)
    //   .then(function(result) {
    //     console.log({payment: result});
    //   })
    //   .catch(function(err) {
    //     console.error(err);
    //   })
    const { _id, price, email, recipient, userId } = order
    await app.service('orders').Model.updateOne({ _id }, { $set: { status } })
    const D = new Date()
    const expiredAt = D.setMonth(D.getMonth() + 12)
    const elcerts = await app.service('elcerts').create({ price, sum: price, email, userId, recipient, orderId: _id, expiredAt })
    res.send('ok')
  })

  cron.schedule("0 59 23 * * *", () => {
    checkExpired('writeOff')
  })

  cron.schedule("0 0 9 * * *", () => {
    checkExpired('sendSMS')
  })

  // The `authentication` service is used to create a JWT.
  // The before `create` hook registers strategies that can be used
  // to create a new valid JWT (e.g. local or oauth2)
  app.service('authentication').hooks({
    before: {
      create: [
        authentication.hooks.authenticate(config.strategies),
        // This hook adds the `test` attribute to the JWT payload by
        // modifying params.payload.
        hook => {
          // make sure params.payload exists
          hook.params.payload = hook.params.payload || {}
          Object.assign(hook.params.payload, {role: hook.params.user.role, userId: hook.params.user._id})
        }
      ],
      remove: [
        authentication.hooks.authenticate('jwt')
      ]
    },
    after: {
      create: [
        hook => {
          if (!_.get(hook, 'params.user')) {
            return Promise.reject(new errors.Forbidden('Credentials incorrect'))
          }

          hook.result.user = hook.params.user

          // Don't expose sensitive information.
          delete hook.result.user.password
        }
      ]
    }
  })
}
