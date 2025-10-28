// Initializes the `users` service on path `/users`
const createService = require('feathers-mongoose');
// const createService = require('feathers-mongodb');
const createModel = require('../../models/users.model');
const hooks = require('./users.hooks');
const filters = require('./users.filters');

module.exports = function () {
  const app = this;
  const Model = createModel(app);
  const paginate = app.get('paginate');
  // const mongoClient = app.get('mongoClient');
  // const options = { paginate };
  const options = {
    name: 'users',
    Model,
    paginate,
    whitelist: [ '$options', '$regex' ]
  };

  // Initialize our service with any options it requires
  app.use('/users', createService(options));

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('users');

  // mongoClient.then(db => {
  //   service.Model = db.collection('users');
  // });

  service.hooks(hooks);

  if (service.filter) {
    service.filter(filters);
  }
};
