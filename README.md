# E-commerce Microservices API

## 📋 Описание проекта

Это система микросервисов для интернет-магазина, построенная на основе архитектуры из диаграммы. Система включает в себя три основных сервиса:

- **Product Service** - управление товарами
- **Cart Service** - управление корзиной и пользователями  
- **Orchestrator Service** - Saga оркестратор для координации операций

## 🏗️ Структура проекта

```
ecommerce-microservices/
├── services/
│   ├── product/          # Сервис товаров (порт 50051)
│   ├── cart/            # Сервис корзины с авторизацией (порт 50052)
│   └── orchestrator/    # Saga оркестратор (порт 50053)
├── proto/               # gRPC протобуфы
├── scripts/             # Скрипты для настройки БД
├── postman/             # Инструкции по тестированию gRPC
├── docker-compose.yml   # Docker конфигурация для всех сервисов
└── README.md
```

## 🚀 ИНСТРУКЦИЯ ПО ЗАПУСКУ

### ⚡ Docker Compose (рекомендуется)

**Запуск всех сервисов:**
```bash
docker-compose up --build
```

**Запуск в фоновом режиме:**
```bash
docker-compose up -d --build
```

**Остановка:**
```bash
docker-compose down
```

Эта команда автоматически:
1. 🐳 Соберет все Docker контейнеры
2. 🗄️ Запустит PostgreSQL базы данных
3. 🚀 Запустит все 3 микросервиса
4. 🔗 Настроит сеть между сервисами
5. 📊 Покажет логи всех сервисов в одном окне

### 🔧 Локальный запуск (альтернатива)

Если хотите запускать без Docker:

1. **Установите Node.js** с https://nodejs.org/
2. **Запустите базы данных:**
   ```bash
   docker-compose up -d
   ```
3. **Установите зависимости:**
   ```bash
   npm run install:all
   ```
4. **Запустите сервисы:**
   ```bash
   npm run start:all
   ```

### 📊 Проверка работы

После запуска вы должны увидеть сообщения:
- `Product service running on port 50051`
- `Cart service running on port 50052`
- `Orchestrator service running on port 50053`

## 🧪 ТЕСТИРОВАНИЕ

### Автоматическое тестирование:
```bash
node test-client.js
```

### Ручное тестирование с grpcurl:

**Установка grpcurl:**
- Windows: скачайте с https://github.com/fullstorydev/grpcurl/releases
- Linux/Mac: `brew install grpcurl`

**Примеры команд:**

```bash
# Создание товара
grpcurl -plaintext -d '{"name":"Test Product","description":"Test","price":99.99,"stock":100,"category":"Electronics"}' localhost:50051 product.ProductService/CreateProduct

# Регистрация пользователя
grpcurl -plaintext -d '{"email":"test@example.com","password":"password123","name":"Test User","phone":"+7-999-123-45-67","address":"Moscow"}' localhost:50052 cart.CartService/RegisterUser

# Добавление в корзину
grpcurl -plaintext -d '{"user_id":"USER_ID","product_id":"PRODUCT_ID","quantity":2,"price":99.99}' localhost:50052 cart.CartService/AddToCart
```

## 📊 Мониторинг и отладка

### Проверка статуса контейнеров:
```bash
docker-compose ps
```

### Просмотр логов:
```bash
# Все сервисы
docker-compose logs -f

# Конкретный сервис
docker-compose logs -f product-service
```

### Подключение к базам данных:
```bash
# База товаров
docker exec -it postgres-products psql -U postgres -d products_db

# База корзины
docker exec -it postgres-cart psql -U postgres -d cart_db
```

## 🎮 Команды для управления

### 🐳 Docker Compose:
```bash
# Запуск всех сервисов
docker-compose up --build

# Запуск в фоновом режиме
docker-compose up -d --build

# Остановка всех сервисов
docker-compose down

# Просмотр логов
docker-compose logs -f

# Пересборка конкретного сервиса
docker-compose up --build product-service

# Просмотр статуса
docker-compose ps
```

### 🚀 Локальный запуск:
```bash
# Все сервисы одновременно
npm run start:all

# Режим разработки (с автоперезагрузкой)
npm run start:dev

# Отдельные сервисы
npm run start:product
npm run start:cart
npm run start:orchestrator
```

### 🧪 Тестирование:
```bash
# Автоматическое тестирование всех API
npm test

# Или напрямую
node test-client.js
```

## 📝 API Endpoints

### Product Service (localhost:50051)
- `CreateProduct` - создание товара
- `GetProduct` - получение товара по ID
- `UpdateProduct` - обновление товара
- `DeleteProduct` - удаление товара
- `ListProducts` - список товаров с пагинацией

### Cart Service (localhost:50052)
- `RegisterUser` - регистрация пользователя
- `LoginUser` - авторизация пользователя
- `GetUser` - получение информации о пользователе
- `UpdateUser` - обновление информации о пользователе
- `AddToCart` - добавление товара в корзину
- `GetCart` - получение корзины пользователя
- `UpdateCartItem` - обновление количества товара в корзине
- `RemoveFromCart` - удаление товара из корзины
- `ClearCart` - очистка корзины

### Orchestrator Service (localhost:50053)
- `ProcessOrder` - обработка заказа (Saga)
- `GetOrderStatus` - получение статуса заказа
- `CancelOrder` - отмена заказа

## 🔧 Возможные проблемы и решения

### Проблема: "Port already in use"
**Решение:** Найдите и завершите процесс, использующий порт:
```bash
# Windows
netstat -ano | findstr :50051
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:50051 | xargs kill -9
```

### Проблема: "Cannot connect to database"
**Решение:** 
1. Убедитесь, что Docker контейнеры запущены: `docker-compose ps`
2. Проверьте логи: `docker-compose logs postgres-products`

### Проблема: "Module not found"
**Решение:** Переустановите зависимости:
```bash
npm run install:all
```

## 🎯 Следующие шаги

После успешного запуска системы вы можете:
1. Расширить функциональность сервисов
2. Добавить больше тестов
3. Настроить мониторинг
4. Добавить аутентификацию JWT
5. Реализовать дополнительные Saga операции

## 📞 Поддержка

Если возникли проблемы:
1. Проверьте логи всех сервисов: `docker-compose logs -f`
2. Убедитесь, что все порты свободны
3. Проверьте подключение к базам данных
4. Перезапустите систему: `docker-compose down && docker-compose up --build`