/**
 * Настройка аутентификации и стратегий
 */

const errors = require('@feathersjs/errors');
const { AuthenticationService, JWTStrategy } = require('@feathersjs/authentication');
const { LocalStrategy } = require('@feathersjs/authentication-local');

/**
 * Кастомный AuthenticationService
 */
class MyAuthenticationService extends AuthenticationService {
  async getPayload(authResult, params) {
    return {
      ...authResult
    };
  }
}

/**
 * Legacy JWT Strategy для поддержки старых токенов
 */
class LegacyJWTStrategy extends JWTStrategy {
  getEntityId(authResult) {
    const { authentication: { payload } } = authResult;
    return payload.userId || payload.sub;
  }
}

/**
 * SMS Strategy для аутентификации по коду из SMS
 */
class SMSStrategy extends LocalStrategy {
  constructor(app) {
    super();
    this.app = app;
  }

  async authenticate(data, params) {
    const phone = data['phone'];
    const code = data['code'];
    const app = this.app;

    const payload = await app.service('codes').find({ query: { phone } }).then(async function(response) {
      const results = response.data || response;
      
      if (!results.length) {
        throw new errors.NotAuthenticated({ message: 'Телефон не зарегистрирован' });
      }
      
      const codeModel = results[0];
      
      if (codeModel.code !== code) {
        throw new errors.NotAuthenticated({ message: 'Неправильный код' });
      }
      
      // Удаляем использованный код
      await app.service('codes').remove(codeModel._id);
      
      // Ищем пользователя
      const userResponse = await app.service('users').find({ query: { phone } });
      const users = userResponse.data || userResponse;
      let user;
      
      if (!users.length) {
        // Создаем пользователя, если его нет
        user = await app.service('users').create({ phone });
      } else {
        user = users[0];
      }
      
      return {
        ...user,
      };
    });

    console.log('SMS authentication payload:', payload);

    return {
      ...payload,
    };
  }
}

/**
 * Legacy Local Strategy для стандартной аутентификации
 */
class LegacyLocalStrategy extends LocalStrategy {
  constructor(app) {
    super();
    this.app = app;
  }

  async authenticate(data, params) {
    const payload = await super.authenticate(data, params);
    console.log('LegacyLocalStrategy', payload);
    return { ...payload };
  }
}

/**
 * Конфигурация аутентификации
 */
module.exports = function() {
  const app = this;
  const config = app.get('authentication');

  // Создаем сервис аутентификации
  const authentication = new MyAuthenticationService(app);

  // Регистрируем стратегии
  authentication.register('jwt', new LegacyJWTStrategy());
  authentication.register('local', new LegacyLocalStrategy(app));
  authentication.register('mobile', new SMSStrategy(app));

  // Подключаем сервис
  app.use('/authentication', authentication);

  console.log('Authentication strategies initialized');
};
