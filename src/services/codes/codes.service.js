// Initializes the `codes` service on path `/codes`
const createService = require('feathers-mongoose');
const createModel = require('../../models/codes.model');
const hooks = require('./codes.hooks');
const filters = require('./codes.filters');

module.exports = function () {
  const app = this;
  const Model = createModel(app);
  const paginate = app.get('paginate');

  const options = {
    name: 'codes',
    Model,
    paginate
  };

  // Initialize our service with any options it requires
  app.use('/codes', createService(options));

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('codes');

  service.hooks(hooks);

  if (service.filter) {
    service.filter(filters);
  }
};
