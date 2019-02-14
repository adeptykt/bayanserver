// A hook that logs service method before, after and error
const winston = require('winston');
const util = require('util')
var logger = new winston.Logger({
  level: 'debug',
  transports: [
    new (winston.transports.Console)({'timestamp':true, 'colorize':true})
  ]
});

module.exports = function () {
  let prefix = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
  // console.log('prefix: ' + util.inspect(prefix, false, null))
  return function (hook) {
    let message = `${prefix}${hook.type}: ${hook.path} - Method: ${hook.method}`;

    if (hook.type === 'error') {
      message += `: ${hook.error.message}`;
    }

    logger.info(message);
    // logger.debug('hook', hook);
    logger.debug('hook.data', hook.data);
    logger.debug('hook.params', hook.params);

    if (hook.result) {
      logger.debug('hook.result', hook.result);
    }

    if (hook.error) {
      logger.error(hook.error);
    }
  };
};
