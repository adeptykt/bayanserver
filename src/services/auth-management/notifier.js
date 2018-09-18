module.exports = function(app) {

  function sendSms(sms) {
    // return app.service('emails').create(email).then(function (result) {
    //   console.log('Sent sms', result)
    // }).catch(err => {
    //   console.log('Error sending sms', err)
    // })
  }

  return {
    notifier: function(type, user, notifierOptions) {
      console.log(`-- Preparing sms for ${type}`)
      var email
      switch (type) {
        case 'resendVerifySignup': // send another email with link for verifying user's email addr

          sms = {
             from: process.env.GMAIL,
             to: user.phone,
             text: 'Ваш код: 1234',
             html: compiledHTML
          }

          return sendSms(sms)
        case 'verifySignup': // inform that user's email is now confirmed

          email = {
             from: process.env.GMAIL,
             to: user.email,
             subject: 'Thank you, your email has been verified',
             html: compiledHTML
          }

          return sendEmail(email)
      }
    }
  }
}
