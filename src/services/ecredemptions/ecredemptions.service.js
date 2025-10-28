// Initializes the `redemptions` service on path `/redemptions`
const createService = require('feathers-mongoose');
const createModel = require('../../models/ecredemptions.model');
const hooks = require('./ecredemptions.hooks');
const filters = require('./ecredemptions.filters');

module.exports = function () {
  const app = this;
  const Model = createModel(app);
  const paginate = app.get('paginate');

  const options = {
    name: 'ecredemptions',
    Model,
    paginate
  };

  // Initialize our service with any options it requires
  app.use('/ecredemptions', createService(options));

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('ecredemptions');

  service.hooks(hooks);

  if (service.filter) {
    service.filter(filters);
  }
};
