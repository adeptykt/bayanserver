// Initializes the `bonuses` service on path `/bonuses`
const createService = require('feathers-mongoose');
const createModel = require('../../models/bonuses.model');
const hooks = require('./bonuses.hooks');
const filters = require('./bonuses.filters');

module.exports = function () {
  const app = this;
  const Model = createModel(app);
  const paginate = app.get('paginate');

  const options = {
    name: 'bonuses',
    Model,
    paginate
  };

  // Initialize our service with any options it requires
  app.use('/bonuses', createService(options));

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('bonuses');

  service.hooks(hooks);

  if (service.filter) {
    service.filter(filters);
  }
};
