const path = require('path');
// const handler = require('feathers-errors/handler');
// const NotFound = require('@feathersjs/errors');

module.exports = function () {
  // Add your custom middleware here. Remember, that
  // in Express the order matters, `notFound` and
  // the error handler have to go last.
  const app = this;

  const filename = path.join(__dirname, '..', '..', 'public')
  app.get('/MobileAgreement.html', function(req, res) {
    var html = fs.readFileSync(filename + '/MobileAgreement.html');
    var $ = cheerio.load(html);
    res.send($.html());
  });

  // app.use(NotFound());
  // app.use(handler());
};
