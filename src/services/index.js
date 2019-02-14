// const authManagement = require('./auth-management/auth-management.service.js');
const users = require('./users/users.service.js');
const settings = require('./settings/settings.service.js');
const operations = require('./operations/operations.service.js');
const codes = require('./codes/codes.service.js');
const tokens = require('./tokens/tokens.service.js');
const roles = require('./roles/roles.service.js');

const notifications = require('./notifications/notifications.service.js');

const cards = require('./cards/cards.service.js');
const certificates = require('./certificates/certificates.service.js');
const redemptions = require('./redemptions/redemptions.service.js');
const orders = require('./orders/orders.service.js');
const elcerts = require('./elcerts/elcerts.service.js');

module.exports = function () {
  const app = this; // eslint-disable-line no-unused-vars

  // app.configure(authManagement);
  app.configure(users);
  app.configure(settings);
  app.configure(operations);
  app.configure(codes);
  app.configure(tokens);
  app.configure(roles);
  app.configure(notifications);
  app.configure(cards);
  app.configure(certificates);
  app.configure(redemptions);
  app.configure(orders);
  app.configure(elcerts);
};
