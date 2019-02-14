// Initializes the `bonuses` service on path `/bonuses`
const createService = require('feathers-mongoose');
const createModel = require('../../models/elcerts.model');
const hooks = require('./elcerts.hooks');
const filters = require('./elcerts.filters');

module.exports = function () {
  const app = this;
  const Model = createModel(app);
  const paginate = app.get('paginate');

  const options = {
    name: 'elcerts',
    Model,
    paginate
  };

  // Initialize our service with any options it requires
  app.use('/elcerts', createService(options));

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('elcerts');

  service.hooks(hooks);

  if (service.filter) {
    service.filter(filters);
  }
};
