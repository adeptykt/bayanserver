// Initializes the `tokens` service on path `/tokens`
const createService = require('feathers-mongoose');
const createModel = require('../../models/tokens.model');
const hooks = require('./tokens.hooks');
const filters = require('./tokens.filters');

module.exports = function () {
  const app = this;
  const Model = createModel(app);
  const paginate = app.get('paginate');

  const options = {
    name: 'tokens',
    Model,
    paginate
  };

  // Initialize our service with any options it requires
  app.use('/tokens', createService(options));

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('tokens');

  service.hooks(hooks);

  if (service.filter) {
    service.filter(filters);
  }
};
