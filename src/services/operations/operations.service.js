// Initializes the `operations` service on path `/operations`
const createService = require('feathers-mongoose');
const createModel = require('../../models/operations.model');
const hooks = require('./operations.hooks');
const filters = require('./operations.filters');

module.exports = function () {
  const app = this;
  const Model = createModel(app);
  const paginate = app.get('paginate');

  const options = {
    name: 'operations',
    Model,
    paginate
  };

  // Initialize our service with any options it requires
  app.use('/operations', createService(options));

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('operations');

  service.hooks(hooks);

  if (service.filter) {
    service.filter(filters);
  }
};
