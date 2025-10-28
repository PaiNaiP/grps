const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

// Загрузка протобуфов
const productPackageDefinition = protoLoader.loadSync('./proto/product.proto', {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const cartPackageDefinition = protoLoader.loadSync('./proto/cart.proto', {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const orchestratorPackageDefinition = protoLoader.loadSync('./proto/orchestrator.proto', {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const productProto = grpc.loadPackageDefinition(productPackageDefinition).product;
const cartProto = grpc.loadPackageDefinition(cartPackageDefinition).cart;
const orchestratorProto = grpc.loadPackageDefinition(orchestratorPackageDefinition).orchestrator;

// Клиенты
const productClient = new productProto.ProductService('localhost:50051', grpc.credentials.createInsecure());
const cartClient = new cartProto.CartService('localhost:50052', grpc.credentials.createInsecure());
const orchestratorClient = new orchestratorProto.OrchestratorService('localhost:50053', grpc.credentials.createInsecure());

// Глобальные переменные для хранения ID
let createdProductId = '';
let createdUserId = '';
let createdCartItemId = '';
let createdOrderId = '';

// Функции для работы с Product Service
function createProduct() {
  console.log('\n=== СОЗДАНИЕ ТОВАРА ===');
  
  productClient.CreateProduct({
    name: 'iPhone 15 Pro',
    description: 'Новый iPhone с титановым корпусом',
    price: 1299.99,
    stock: 50,
    category: 'Electronics'
  }, (err, response) => {
    if (err) {
      console.error(' Ошибка создания товара:', err.message);
      return;
    }
    console.log('Товар создан успешно:');
    console.log('ID:', response.product.id);
    console.log('Название:', response.product.name);
    console.log('Цена:', response.product.price);
    console.log('Остаток:', response.product.stock);
    
    createdProductId = response.product.id;
  });
}

function getProduct(productId) {
  console.log('\n=== ПОЛУЧЕНИЕ ТОВАРА ===');
  
  productClient.GetProduct({ id: productId }, (err, response) => {
    if (err) {
      console.error('Ошибка получения товара:', err.message);
      return;
    }
    console.log('Товар получен:');
    console.log('ID:', response.product.id);
    console.log('Название:', response.product.name);
    console.log('Описание:', response.product.description);
    console.log('Цена:', response.product.price);
    console.log('Остаток:', response.product.stock);
    console.log('Категория:', response.product.category);
  });
}

function listProducts() {
  console.log('\n=== СПИСОК ТОВАРОВ ===');
  
  productClient.ListProducts({
    page: 1,
    limit: 5,
    category: 'Electronics'
  }, (err, response) => {
    if (err) {
      console.error('Ошибка получения списка товаров:', err.message);
      return;
    }
    console.log('Список товаров:');
    console.log('Всего товаров:', response.total);
    console.log('Страница:', response.page);
    console.log('Товары:');
    response.products.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name} - $${product.price} (остаток: ${product.stock})`);
    });
  });
}

// Функции для работы с Cart Service
function registerUser() {
  console.log('\n=== РЕГИСТРАЦИЯ ПОЛЬЗОВАТЕЛЯ ===');
  
  cartClient.RegisterUser({
    email: 'test@example.com',
    password: 'password123',
    name: 'Тестовый Пользователь',
    phone: '+7-999-123-45-67',
    address: 'Москва, Красная площадь, 1'
  }, (err, response) => {
    if (err) {
      console.error('Ошибка регистрации:', err.message);
      return;
    }
    console.log('Пользователь зарегистрирован:');
    console.log('ID:', response.user.id);
    console.log('Email:', response.user.email);
    console.log('Имя:', response.user.name);
    console.log('Телефон:', response.user.phone);
    
    createdUserId = response.user.id;
  });
}

function loginUser() {
  console.log('\n=== АВТОРИЗАЦИЯ ПОЛЬЗОВАТЕЛЯ ===');
  
  cartClient.LoginUser({
    email: 'test@example.com',
    password: 'password123'
  }, (err, response) => {
    if (err) {
      console.error('Ошибка авторизации:', err.message);
      return;
    }
    console.log('Пользователь авторизован:');
    console.log('Токен:', response.token);
    console.log('Пользователь:', response.user.name);
  });
}

function addToCart() {
  console.log('\n=== ДОБАВЛЕНИЕ В КОРЗИНУ ===');
  
  cartClient.AddToCart({
    user_id: createdUserId,
    product_id: createdProductId,
    quantity: 2,
    price: 1299.99
  }, (err, response) => {
    if (err) {
      console.error('Ошибка добавления в корзину:', err.message);
      return;
    }
    console.log('Товар добавлен в корзину:');
    console.log('ID товара в корзине:', response.cart_item.id);
    console.log('Количество:', response.cart_item.quantity);
    console.log('Цена:', response.cart_item.price);
    
    createdCartItemId = response.cart_item.id;
  });
}

function getCart() {
  console.log('\n=== ПОЛУЧЕНИЕ КОРЗИНЫ ===');
  
  cartClient.GetCart({ user_id: createdUserId }, (err, response) => {
    if (err) {
      console.error('Ошибка получения корзины:', err.message);
      return;
    }
    console.log('Корзина получена:');
    console.log('Общая сумма:', response.total_amount);
    console.log('Товары в корзине:');
    response.cart_items.forEach((item, index) => {
      console.log(`${index + 1}. Товар ID: ${item.product_id}, Количество: ${item.quantity}, Цена: $${item.price}`);
    });
  });
}

function updateCartItem() {
  console.log('\n=== ОБНОВЛЕНИЕ ТОВАРА В КОРЗИНЕ ===');
  
  cartClient.UpdateCartItem({
    user_id: createdUserId,
    cart_item_id: createdCartItemId,
    quantity: 3
  }, (err, response) => {
    if (err) {
      console.error('Ошибка обновления товара в корзине:', err.message);
      return;
    }
    console.log('Товар в корзине обновлен:');
    console.log('Новое количество:', response.cart_item.quantity);
  });
}

// Функции для работы с Orchestrator Service
function processOrder() {
  console.log('\n=== ОБРАБОТКА ЗАКАЗА (SAGA) ===');
  
  orchestratorClient.ProcessOrder({
    user_id: createdUserId,
    items: [
      {
        product_id: createdProductId,
        quantity: 2,
        price: 1299.99
      }
    ]
  }, (err, response) => {
    if (err) {
      console.error('Ошибка обработки заказа:', err.message);
      return;
    }
    console.log('Заказ обработан:');
    console.log('ID заказа:', response.order_id);
    console.log('Статус:', response.status);
    
    createdOrderId = response.order_id;
  });
}

function getOrderStatus() {
  console.log('\n=== СТАТУС ЗАКАЗА ===');
  
  orchestratorClient.GetOrderStatus({ order_id: createdOrderId }, (err, response) => {
    if (err) {
      console.error('Ошибка получения статуса заказа:', err.message);
      return;
    }
    console.log('✅ Статус заказа:');
    console.log('Статус:', response.status);
    console.log('Общая сумма:', response.total_amount);
    console.log('Товары:');
    response.items.forEach((item, index) => {
      console.log(`${index + 1}. Товар ID: ${item.product_id}, Количество: ${item.quantity}, Цена: $${item.price}`);
    });
  });
}

// Основная функция тестирования
async function runTests() {
  console.log('ЗАПУСК ТЕСТИРОВАНИЯ МИКРОСЕРВИСОВ');
  console.log('=====================================');
  
  // Небольшие задержки между запросами
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  try {
    // Тестирование Product Service
    createProduct();
    await delay(1000);
    
    if (createdProductId) {
      getProduct(createdProductId);
      await delay(1000);
    }
    
    listProducts();
    await delay(1000);
    
    // Тестирование Cart Service
    registerUser();
    await delay(1000);
    
    loginUser();
    await delay(1000);
    
    if (createdUserId && createdProductId) {
      addToCart();
      await delay(1000);
      
      getCart();
      await delay(1000);
      
      updateCartItem();
      await delay(1000);
      
      getCart(); // Проверяем обновленную корзину
      await delay(1000);
    }
    
    // Тестирование Orchestrator Service
    if (createdUserId && createdProductId) {
      processOrder();
      await delay(2000); // Даем время на обработку Saga
      
      if (createdOrderId) {
        getOrderStatus();
      }
    }
    
  } catch (error) {
    console.error('Ошибка при выполнении тестов:', error);
  }
}

// Запуск тестов
console.log('Инструкция по использованию:');
console.log('1. Убедитесь, что все сервисы запущены');
console.log('2. Убедитесь, что Docker контейнеры с БД запущены');
console.log('3. Запустите: node test-client.js');
console.log('');

// Проверяем, что сервисы доступны
const testConnection = () => {
  console.log('Проверка подключения к сервисам...');
  
  // Простой тест подключения
  productClient.ListProducts({ page: 1, limit: 1 }, (err) => {
    if (err) {
      console.log('Product Service недоступен на порту 50051');
    } else {
      console.log('Product Service доступен');
    }
  });
  
  cartClient.GetUser({ user_id: 'test' }, (err) => {
    if (err && err.code === 5) { // NOT_FOUND - это нормально, сервис работает
      console.log('Cart Service доступен');
    } else if (err) {
      console.log('Cart Service недоступен на порту 50052');
    }
  });
  
  orchestratorClient.GetOrderStatus({ order_id: 'test' }, (err) => {
    if (err && err.code === 5) { // NOT_FOUND - это нормально, сервис работает
      console.log('Orchestrator Service доступен');
    } else if (err) {
      console.log('Orchestrator Service недоступен на порту 50053');
    }
  });
};

testConnection();

// Запускаем тесты через 2 секунды
setTimeout(runTests, 2000);
