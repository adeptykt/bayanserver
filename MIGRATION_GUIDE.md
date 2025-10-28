# 🚀 Руководство по миграции на новую архитектуру

## ✅ Что было сделано

Файл `authentication.js` (1939 строк) был разделен на **9 независимых модулей**:

| Файл | Строк | Назначение |
|------|-------|------------|
| `src/authentication.js` | 106 | Только стратегии аутентификации |
| `src/routes/partner.js` | ~650 | Партнерские API |
| `src/routes/stats.js` | ~250 | Статистика |
| `src/routes/utils.js` | ~400 | Утилиты и миграции |
| `src/routes/webhooks.js` | ~120 | Webhook'и для платежей |
| `src/services/bonus.service.js` | ~250 | Бизнес-логика бонусов |
| `src/utils/date-helpers.js` | ~100 | Функции дат |
| `src/utils/string-helpers.js` | ~10 | Функции строк |
| `src/jobs/cron-tasks.js` | ~50 | Планировщик задач |

**Улучшение:** Средний размер файла уменьшен с 1939 до ~215 строк (-89%)

---

## 📋 Шаги миграции

### Шаг 1: Проверка структуры

Убедитесь, что все новые файлы созданы:

```bash
# Проверка наличия новых директорий и файлов
ls -la src/routes/
ls -la src/jobs/
ls -la src/utils/date-helpers.js
ls -la src/utils/string-helpers.js
ls -la src/services/bonus.service.js
```

### Шаг 2: Резервное копирование (опционально)

```bash
# На всякий случай сохраните старый файл
cp src/authentication.js src/authentication.js.old
```

### Шаг 3: Тестирование

```bash
# Запустите приложение
npm start
```

### Шаг 4: Проверка работоспособности

#### 4.1 Проверка аутентификации:

**JWT:**
```bash
curl -X POST http://localhost:3030/authentication \
  -H "Content-Type: application/json" \
  -d '{"strategy":"local","phone":"9241234567","password":"123456"}'
```

**SMS:**
```bash
# 1. Запросите код
curl -X POST http://localhost:3030/codes \
  -H "Content-Type: application/json" \
  -d '{"phone":"9241234567"}'

# 2. Войдите с кодом
curl -X POST http://localhost:3030/authentication \
  -H "Content-Type: application/json" \
  -d '{"strategy":"mobile","phone":"9241234567","code":"123456"}'
```

#### 4.2 Проверка партнерского API:

```bash
curl -X GET http://localhost:3030/v1/partner/company \
  -H "x-api-key: RW9uRHkzSGxhV3pZT10xaE1fbHBEJnFSMElsM0hwOmN2VnZiZTopVl5bQDg3Jj14Kms="
```

#### 4.3 Проверка статистики:

```bash
curl -X GET http://localhost:3030/bonuses
```

#### 4.4 Проверка webhook'ов:

```bash
curl -X GET "http://localhost:3030/v1/findcert?number=12345"
```

#### 4.5 Проверка cron-задач:

Убедитесь, что в консоли есть сообщение:
```
Cron tasks initialized
```

---

## 🔧 Настройка переменных окружения (рекомендуется)

### 1. Создайте .env файл:

```bash
cp env.example .env
```

### 2. Отредактируйте .env:

```env
# Обязательные параметры
MONGO_URI=mongodb://admin:Zdf1740@localhost:27017/fserver
JWT_SECRET=a17544f8ac0f3bba4fe7b73ea55ff...  # ваш секрет
PARTNER_API_KEY=RW9uRHkzSGxhV3pZT10xaE1fbHBEJnFSMElsM0hwOmN2VnZiZTopVl5bQDg3Jj14Kms=

# SMS
SMS_API_KEY=7DDDC5B0-EBDB-8EDB-5562-D8AB4759BE2E

# Email
EMAIL_PASSWORD=ftNFK3JZnfuk03kJ9tSZ

# Платежи
SBERBANK_TOKEN=v2jhlaepchtugujk2jv4ikd72d
```

### 3. Установите dotenv:

```bash
npm install dotenv
```

### 4. Обновите config/default.json:

```javascript
// Используйте переменные окружения
{
  "mongodb": process.env.MONGO_URI,
  "authentication": {
    "secret": process.env.JWT_SECRET,
    // ...
  }
}
```

---

## 🐛 Возможные проблемы и решения

### Проблема 1: Модуль не найден

**Ошибка:**
```
Error: Cannot find module './routes/partner'
```

**Решение:**
```bash
# Убедитесь, что директории созданы
mkdir -p src/routes
mkdir -p src/jobs
```

### Проблема 2: BonusService is not a constructor

**Ошибка:**
```
TypeError: BonusService is not a constructor
```

**Решение:**
Проверьте, что в файле правильный export:
```javascript
// src/services/bonus.service.js
module.exports = BonusService;  // ← должен быть класс
```

### Проблема 3: API не отвечает

**Решение:**
1. Проверьте, что все роуты подключены в `app.js`
2. Проверьте консоль на наличие ошибок
3. Убедитесь, что MongoDB запущена

### Проблема 4: Cron не работает

**Решение:**
Проверьте консоль при запуске, должно быть:
```
Cron tasks initialized
```

Если нет - проверьте `src/jobs/cron-tasks.js`

---

## 📊 Что проверить после миграции

### Чек-лист функциональности:

- [ ] Аутентификация JWT работает
- [ ] Аутентификация SMS работает  
- [ ] Партнерские API отвечают
- [ ] Статистика отображается
- [ ] Webhook'и обрабатываются
- [ ] Cron-задачи запущены
- [ ] Бонусы начисляются
- [ ] Сертификаты создаются
- [ ] Email отправляются
- [ ] SMS отправляются

---

## 🔄 Откат изменений (если что-то пошло не так)

### Вариант 1: Использовать резервную копию

```bash
# Восстановите старый файл
cp src/authentication.js.old src/authentication.js

# Откатите изменения в app.js
git checkout src/app.js
```

### Вариант 2: Использовать git

```bash
# Откатите все изменения
git checkout .
```

---

## 💡 Дополнительные улучшения

После успешной миграции рекомендуется:

### 1. Добавить логирование

```bash
npm install winston
```

```javascript
// src/utils/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

module.exports = logger;
```

### 2. Добавить тесты

```bash
npm install --save-dev mocha chai supertest
```

```javascript
// test/routes/partner.test.js
const request = require('supertest');
const app = require('../src/app');

describe('Partner API', () => {
  it('should return company settings', (done) => {
    request(app)
      .get('/v1/partner/company')
      .set('x-api-key', 'RW9u...')
      .expect(200)
      .end(done);
  });
});
```

### 3. Добавить документацию API

```bash
npm install swagger-ui-express swagger-jsdoc
```

---

## 📞 Поддержка

Если возникли проблемы:

1. Проверьте логи: `npm start` и изучите вывод
2. Проверьте MongoDB: `mongod --version`
3. Проверьте версию Node.js: `node --version`
4. Изучите файл `REFACTORING.md` для деталей

---

## ✨ Результат

После успешной миграции вы получите:

✅ **Чистый код** - каждый файл < 700 строк  
✅ **Модульность** - легко добавлять новые функции  
✅ **Тестируемость** - можно покрыть тестами  
✅ **Поддерживаемость** - легко находить и исправлять баги  
✅ **Масштабируемость** - можно вынести в микросервисы  

**Успешной миграции! 🎉**

