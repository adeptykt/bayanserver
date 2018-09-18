const SMSru = require('sms_ru');
const api_id = '7DDDC5B0-EBDB-8EDB-5562-D8AB4759BE2E'; // байанай
const smsru = new SMSru(api_id);

exports.sms = function sms(to, text) {
    smsru.sms_send({
      from: 'bayanay',
      partner_id: 194850,
      to,
      text
    }, function(e) {
      // log.info(e.description);
    });
}