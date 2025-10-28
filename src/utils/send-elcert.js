const nodemailer = require("nodemailer")
const pdf = require('html-pdf')
const generateEan13 = require('./generate-ean13')

function createHTMLCert(email, number, price, recipient, date, barcode) {
  return '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">' +
  '<html xmlns="http://www.w3.org/1999/xhtml">' +
  '<head>' +
  '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />' +
  '<title>Сертификат</title>' +
  '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>' +
  '<script src="https://cdn.jsdelivr.net/jsbarcode/3.6.0/barcodes/JsBarcode.ean-upc.min.js"></script>' +
  '</head>' +
  '<body style="margin: 0; font-family: Tahoma;">' +
  '<div style="width: 600px; height: 417px; font-size: 24px; font-weight: bold; text-align: center; border: 1px solid #ddd;">' +
  '<div style="position: absolute; left: 020px; top: 020px; width: 200px; text-align: left">ЭЛЕКТРОННЫЙ ПОДАРОЧНЫЙ СЕРТИФИКАТ</div>' +
  '<img style="position: absolute; left: 394px; top: 020px;" src="logo.png" />' +
  '<svg style="position: absolute; left: 000px; top: 130px; width: 600px;" id="barcode"></svg>' +
  '<div style="position: absolute; left: 000px; top: 240px; width: 600px;">' + price.toPhrase() + '</div>' +
  '<div style="position: absolute; left: 020px; top: 325px; width: 400px; font-size: 12px; font-weight: normal; text-align: left">Этот подарочный сертификат действителен только при предъявлении паспорта лично персоной, указанной как одаряемый при покупке сертификата. Только это лицо может погасить этот электронный сертификат.</div>' +
  '<div style="position: absolute; left: 435px; top: 355px; width: 146px; font-size: 12px; font-weight: normal;">Действителен до</div>' +
  '<div style="position: absolute; left: 435px; top: 370px; width: 146px;">' + date.toLocal() + '</div>' +
  '</div>' +
  '<script type="text/javascript">JsBarcode("#barcode", "' + barcode + '", {format: "ean13", height: 40, displayValue: true, margin: 7, textMargin: 0})</script>' +
  '</body>' +
  '</html>'
}

// width: "450px",
// height: "315px",
const config = {
  "format": "Letter",
  "base": "file:///opt/cert/static/"
}

const transport = nodemailer.createTransport({
  service: "Mail.ru",
  auth: {
      user: "bayanay.store",
      // pass: "VEkxxHdt1ceHnWier1jN"
      pass: "ftNFK3JZnfuk03kJ9tSZ"
  }
})
// user: "admin@bayanay.center",
// pass: "xpqV43&OQFyp"

const mailOptions = {
  from: "Байанай-Центр <bayanay.store@mail.ru>", // sender address
  to: '', // list of receivers
  subject: "Вам подарили сертификат", // Subject line
  text: "Сертификат", // plaintext body
  // html,
  attachments: []
}

async function sendElcert(email, number, price, recipient, date) {
  const barcode = generateEan13(number)
  const html = createHTMLCert(email, number, price, recipient, date, barcode)
  mailOptions.attachments = []
  await pdf.create(html, config).toStream(function(err, stream) {
    mailOptions.to = email
    mailOptions.attachments.push({ filename: 'certificate.pdf', content: stream })
    transport.sendMail(mailOptions).then(info => {
      console.log("Message sent: ", info);
    }).catch(error => {
      console.log("Message error: ", error);
    })
  })
}

module.exports = sendElcert
