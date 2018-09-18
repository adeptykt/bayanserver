const assert = require('assert');
const app = require('../../src/app');

describe('\'codes\' service', () => {
  it('registered the service', () => {
    const service = app.service('codes');

    assert.ok(service, 'Registered the service');
  });
});
