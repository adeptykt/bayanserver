const assert = require('assert');
const app = require('../../src/app');

describe('\'operataions\' service', () => {
  it('registered the service', () => {
    const service = app.service('operataions');

    assert.ok(service, 'Registered the service');
  });
});
