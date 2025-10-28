# 🏗️ Архитектура проекта после рефакторинга

## 📐 Общая схема

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
│  (Mobile App, Web App, POS System, External Partners)           │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ HTTP/WebSocket
                 │
┌────────────────▼────────────────────────────────────────────────┐
│                       APPLICATION LAYER                         │
│                         (Feathers.js)                           │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  AUTHENTICATION                         │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐             │   │
│  │  │   JWT    │  │  Local   │  │   SMS    │             │   │
│  │  └──────────┘  └──────────┘  └──────────┘             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                      ROUTES LAYER                       │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │   │
│  │  │ Partner  │  │  Stats   │  │  Utils   │  │Webhooks│ │   │
│  │  │   API    │  │   API    │  │   API    │  │  API   │ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   BUSINESS LOGIC LAYER                  │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │           BonusService                           │   │   │
│  │  │  • calcScores()                                  │   │   │
│  │  │  • getUserOperations()                           │   │   │
│  │  │  • checkExpired()                                │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  FEATHERS SERVICES                      │   │
│  │  ┌────────┐ ┌────────┐ ┌──────────┐ ┌──────────────┐  │   │
│  │  │ Users  │ │ Cards  │ │Operations│ │Certificates │  │   │
│  │  └────────┘ └────────┘ └──────────┘ └──────────────┘  │   │
│  │  ┌────────┐ ┌────────┐ ┌──────────┐ ┌──────────────┐  │   │
│  │  │ Tokens │ │ Codes  │ │  Orders  │ │   Elcerts   │  │   │
│  │  └────────┘ └────────┘ └──────────┘ └──────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ Mongoose
                 │
┌────────────────▼────────────────────────────────────────────────┐
│                      PERSISTENCE LAYER                          │
│                         MongoDB                                 │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌─────────────┐         │
│  │  users  │ │  cards  │ │operations│ │certificates│         │
│  └─────────┘ └─────────┘ └──────────┘ └─────────────┘         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      BACKGROUND JOBS                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Cron Tasks (jobs/cron-tasks.js)                        │   │
│  │  • 01:00 - MongoDB Backup                               │   │
│  │  • 09:00 - Send SMS (expiring bonuses)                  │   │
│  │  • 23:59 - Write off expired bonuses                    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     EXTERNAL SERVICES                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ SMS.ru   │  │ Mail.ru  │  │ Sberbank │  │   PDF    │       │
│  │   API    │  │  SMTP    │  │Acquiring │  │Generator │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Поток данных

### 1. Аутентификация по SMS

```
┌──────────┐                                    ┌──────────────┐
│  Client  │                                    │ SMS Strategy │
└────┬─────┘                                    └──────┬───────┘
     │                                                 │
     │ 1. Request code                                │
     ├────────────────────────────────────────────────▶
     │                                                 │
     │                        2. Generate code        │
     │                        Save to DB              │
     │                        Send SMS (SMS.ru)       │
     │                                                 │
     │ 3. Code sent                                   │
     ◀────────────────────────────────────────────────┤
     │                                                 │
     │ 4. Login with code                             │
     ├────────────────────────────────────────────────▶
     │                                                 │
     │                        5. Verify code          │
     │                        Get/Create user         │
     │                        Delete code             │
     │                                                 │
     │ 6. JWT token                                   │
     ◀────────────────────────────────────────────────┤
     │                                                 │
```

---

### 2. Покупка через партнерский API

```
┌─────────┐     ┌──────────────┐     ┌──────────────┐     ┌─────────┐
│   POS   │     │PartnerRoutes │     │BonusService  │     │ MongoDB │
└────┬────┘     └──────┬───────┘     └──────┬───────┘     └────┬────┘
     │                 │                     │                   │
     │ 1. Purchase     │                     │                   │
     ├────────────────▶│                     │                   │
     │   (API Key)     │                     │                   │
     │                 │ 2. Verify API key   │                   │
     │                 │                     │                   │
     │                 │ 3. getUserFromToken │                   │
     │                 ├────────────────────▶│                   │
     │                 │                     │ 4. Find user      │
     │                 │                     ├──────────────────▶│
     │                 │                     │ 5. User data      │
     │                 │                     ◀──────────────────┤
     │                 │                     │ 6. calcScores()   │
     │                 │                     ├──────────────────▶│
     │                 │                     ◀──────────────────┤
     │                 │ 7. User with scores │                   │
     │                 ◀────────────────────┤                   │
     │                 │ 8. Create operation │                   │
     │                 ├────────────────────────────────────────▶│
     │                 │ 9. Operation created                    │
     │                 ◀────────────────────────────────────────┤
     │ 10. Success     │                     │                   │
     ◀─────────────────┤                     │                   │
     │                 │                     │                   │
```

---

### 3. Заказ электронного сертификата

```
┌────────┐  ┌────────┐  ┌──────────┐  ┌─────────┐  ┌────────┐
│ Client │  │ Orders │  │ Sberbank │  │Webhooks │  │ Elcerts│
└───┬────┘  └───┬────┘  └────┬─────┘  └────┬────┘  └───┬────┘
    │           │             │             │            │
    │ 1. Create │             │             │            │
    │  order    │             │             │            │
    ├──────────▶│             │             │            │
    │           │ 2. Create   │             │            │
    │           │  payment    │             │            │
    │           ├────────────▶│             │            │
    │           │ 3. Payment  │             │            │
    │           │    URL      │             │            │
    │           ◀────────────┤             │            │
    │ 4. Redirect             │             │            │
    ├────────────────────────▶│             │            │
    │           │             │             │            │
    │           │             │ 5. User pays│            │
    │           │             │             │            │
    │           │             │ 6. Webhook  │            │
    │           │             ├────────────▶│            │
    │           │             │             │ 7. Create  │
    │           │             │             │  elcert    │
    │           │             │             ├───────────▶│
    │           │             │             │ 8. Send    │
    │           │             │             │   email    │
    │           │             │             │            │
    │ 9. Success              │             │            │
    ◀─────────────────────────┤             │            │
    │           │             │             │            │
```

---

## 📦 Модульная структура

### Authentication Module
```
src/authentication.js
├── MyAuthenticationService
│   └── getPayload()
├── LegacyJWTStrategy
│   └── getEntityId()
├── LegacyLocalStrategy
│   └── authenticate()
└── SMSStrategy
    └── authenticate()
```

### Routes Module
```
src/routes/
├── partner.js
│   ├── apikeyVerify (middleware)
│   ├── /v1/partner/* (20+ endpoints)
│   └── BonusService (dependency)
├── stats.js
│   ├── getStats()
│   ├── getCategories()
│   └── /stat* (7 endpoints)
├── utils.js
│   ├── /check* (debug endpoints)
│   └── /migration* (migration endpoints)
└── webhooks.js
    └── /payment, /v1/send*, /v1/find* (6 endpoints)
```

### Business Logic
```
src/services/bonus.service.js
├── BonusService (class)
│   ├── getUserOperations()
│   ├── calcScores()
│   ├── getUserFromToken()
│   ├── getUserFromPhone()
│   └── checkExpired()
```

### Utilities
```
src/utils/
├── date-helpers.js
│   ├── two()
│   ├── addDays()
│   ├── startday()
│   ├── endday()
│   ├── getLocalDate()
│   ├── toJSONLocal()
│   ├── formatDate()
│   ├── isDate()
│   └── parseDate()
└── string-helpers.js
    └── ucFirst()
```

### Background Jobs
```
src/jobs/cron-tasks.js
├── MongoDB Backup (01:00)
├── Expire Bonuses (23:59)
└── SMS Notifications (09:00)
```

---

## 🔌 Интеграции

### External Services
```
┌───────────────────────────────┐
│     External Integrations     │
├───────────────────────────────┤
│ • SMS.ru API                  │
│   - Баллы истекают (уведомл.) │
│   - Активация карты           │
│   - Массовые рассылки         │
├───────────────────────────────┤
│ • Mail.ru SMTP                │
│   - Электронные сертификаты   │
│   - PDF с штрихкодом          │
├───────────────────────────────┤
│ • Sberbank Acquiring          │
│   - Оплата заказов            │
│   - Webhook уведомления       │
├───────────────────────────────┤
│ • MongoDB                     │
│   - Основная БД               │
│   - Агрегации для аналитики   │
└───────────────────────────────┘
```

---

## 🔒 Безопасность

### Authentication Flow
```
Request
   │
   ├── JWT Strategy
   │   ├── Verify token
   │   └── Extract userId/sub
   │
   ├── Local Strategy
   │   ├── Verify phone
   │   ├── Hash password
   │   └── Compare
   │
   └── SMS Strategy
       ├── Find code
       ├── Verify code
       ├── Delete code
       └── Get/Create user

           ▼
      Generate JWT
           ▼
     Return to client
```

### API Key Protection
```
Partner API Request
        │
        ├── Check x-api-key header
        │
        ├── Valid? ──NO──▶ 401 Unauthorized
        │
        └── YES
            │
            ▼
       Execute endpoint
```

---

## 📊 Data Flow Patterns

### Bonus Calculation
```
1. User makes purchase
        │
        ▼
2. Create operation (type=1)
   - scores: -100 (spent)
   - accrual: +10 (earned)
   - validAt: today + 15 days
   - expiredAt: validAt + 365 days
        │
        ▼
3. Trigger calcScores hook
        │
        ▼
4. MongoDB aggregation
   - Group by kind (category)
   - Sum scores + accrual
   - Filter by validAt
        │
        ▼
5. Update user.scores
   Update user.listScores
```

### Expired Bonuses (Cron)
```
Every day at 23:59
        │
        ▼
1. Find operations with expiredAt < today
        │
        ▼
2. For each operation:
   - Calculate available balance
   - Create writeoff operation (type=2)
   - Mark original as expired
        │
        ▼
3. Trigger calcScores for each user
```

---

## 🎯 Design Principles Applied

### 1. Single Responsibility
```
✅ authentication.js  → ТОЛЬКО стратегии
✅ partner.js         → ТОЛЬКО партнерские API
✅ stats.js           → ТОЛЬКО статистика
✅ BonusService       → ТОЛЬКО логика бонусов
```

### 2. Separation of Concerns
```
Routes       → HTTP handlers
Services     → Business logic
Utils        → Helper functions
Jobs         → Background tasks
Models       → Data schemas
```

### 3. DRY (Don't Repeat Yourself)
```
БЫЛО: Копипаста функций дат в разных местах
СТАЛО: Единый модуль date-helpers.js

БЫЛО: Дублирование логики расчета баллов
СТАЛО: BonusService с переиспользуемыми методами
```

### 4. Dependency Injection
```javascript
// BonusService получает app через конструктор
class BonusService {
  constructor(app) {
    this.app = app;  // ← Dependency Injection
  }
}
```

---

## 🚀 Performance Considerations

### 1. Database Queries
- Используются агрегации MongoDB
- Индексы на частые запросы
- Проекции для ограничения данных

### 2. Caching Opportunities
```
Можно добавить:
- Redis для кеширования scores
- In-memory cache для статистики
- CDN для статических файлов
```

### 3. Async Operations
- Все I/O операции асинхронные
- Promise.all для параллельных запросов
- Background jobs для тяжелых задач

---

## 📈 Scalability Path

### Текущая архитектура
```
Monolith (Модульный)
└── All modules in one app
```

### Возможный рост
```
Microservices
├── Auth Service (authentication.js)
├── Partner API Service (routes/partner.js)
├── Stats Service (routes/stats.js)
├── Bonus Service (services/bonus.service.js)
└── Job Scheduler (jobs/cron-tasks.js)
```

**Готовность:** ✅ Модули уже независимы и легко выделяются

---

**Последнее обновление:** 28 октября 2025

