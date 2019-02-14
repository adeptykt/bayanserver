const nodemailer = require("nodemailer")
const pdf = require('html-pdf')

function createHTMLCert(email, number, price, recipient, date) {
  return '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">' +
  '<html xmlns="http://www.w3.org/1999/xhtml">' +
  '<head>' +
  '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />' +
  '<title>Сертификат</title>' +
  '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>' +
  '<script src="https://cdn.jsdelivr.net/jsbarcode/3.6.0/barcodes/JsBarcode.ean-upc.min.js"></script>' +
  '</head>' +
  '<body style="margin: 0; font-family: Tahoma;">' +
  '<div style="width: 600px; height: 417px; font-size: 16px; font-weight: bold; text-align: center;">' +
  '<img src="cert600.png" />' +
  // '<div style="position: absolute; left: 310px; top: 161px; font-size: 24px; width: 170px;">' + number + '</div>' +
  '<div style="position: absolute; left: 62px; top: 220px; width: 476px;">' + recipient + '</div>' +
  '<div style="position: absolute; left: 62px; top: 241px; width: 476px;">' + email + '</div>' +
  '<div style="position: absolute; left: 110px; top: 268px; width: 428px;">' + price.toPhrase() + '</div>' +
  '<div style="position: absolute; left: 394px; top: 343px; font-size: 24px; width: 146px;"s>' + date.toLocal() + '</div>' +
  '<svg style="position: absolute; left: 310px; top: 133px; width: 170px;" id="barcode"></svg>' +
  '</div>' +
  '<script type="text/javascript">JsBarcode("#barcode", "123456789012", {format: "ean13", height: 40, displayValue: false, margin: 7, textMargin: 0})</script>' +
  '</body>' +
  '</html>'
}

const config = {
  // width: "450px",
  // height: "315px",
  base: "file:///c:/nginx/html/"
}

const transport = nodemailer.createTransport({
  service: "Mail.ru",
  auth: {
      user: "admin@bayanay.center",
      pass: "xpqV43&OQFyp"
  }
})

const mailOptions = {
  from: "Байанай-Центр <admin@bayanay.center>", // sender address
  to: '', // list of receivers
  subject: "Вам подарили сертификат", // Subject line
  text: "Сертификат", // plaintext body
  // html,
  attachments: []
  //   {   // stream as an attachment
  //     filename: 'certificate.pdf',
  //     // content: stream
  //     path: './cert.pdf'
  //   }
  // ]
}

async function sendEmail(email, number, price, recipient, date) {
  const html = createHTMLCert(email, number, price, recipient, date)
  // await pdf.create(html, config).toFile("./cert.pdf", function(err, res) {
  //   if (err) console.log("error", err)
  //   console.log(res.filename)
  // })
  // console.log('end pdf created')
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

module.exports = sendEmail
