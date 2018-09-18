const assert = require('assert');
const app = require('../../src/app');

describe('\'bonuses\' service', () => {
  it('registered the service', () => {
    const service = app.service('bonuses');

    assert.ok(service, 'Registered the service');
  });
});
