// Initializes the `bonuses` service on path `/bonuses`
const createService = require('feathers-mongoose');
const createModel = require('../../models/certificates.model');
const hooks = require('./certificates.hooks');
const filters = require('./certificates.filters');

module.exports = function () {
  const app = this;
  const Model = createModel(app);
  const paginate = app.get('paginate');

  const options = {
    name: 'certificates',
    Model,
    paginate,
    whitelist: [ '$exists', '$gt', '$lt', '$gte', '$lte' ]
  };

  // Initialize our service with any options it requires
  app.use('/certificates', createService(options));

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('certificates');

  service.hooks(hooks);

  if (service.filter) {
    service.filter(filters);
  }
};
