const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { v4: uuidv4 } = require('uuid');

// Загрузка протобуфов
const packageDefinition = protoLoader.loadSync('./proto/orchestrator.proto', {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const orchestratorProto = grpc.loadPackageDefinition(packageDefinition).orchestrator;

// Загрузка клиентов для других сервисов
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

const productProto = grpc.loadPackageDefinition(productPackageDefinition).product;
const cartProto = grpc.loadPackageDefinition(cartPackageDefinition).cart;

// Создание клиентов для других сервисов
const productClient = new productProto.ProductService(
  process.env.PRODUCT_SERVICE_URL || 'localhost:50051', 
  grpc.credentials.createInsecure()
);
const cartClient = new cartProto.CartService(
  process.env.CART_SERVICE_URL || 'localhost:50052', 
  grpc.credentials.createInsecure()
);

// Хранилище для отслеживания состояния заказов
const orderStates = new Map();
// Индекс заказов по пользователям
const userOrders = new Map();

// Saga шаги для обработки заказа
class OrderSaga {
  constructor(orderId, userId, items) {
    this.orderId = orderId;
    this.userId = userId;
    this.items = items;
    this.currentStep = 0;
    this.completedSteps = [];
    this.compensatedSteps = [];
    this.status = 'PENDING';
    this.created_at = new Date().toISOString();
  }

  async execute() {
    try {
      console.log(`Starting order processing for order ${this.orderId}`);
      
      // Шаг 1: Проверка наличия товаров
      await this.checkProductAvailability();
      
      // Шаг 2: Резервирование товаров
      await this.reserveProducts();
      
      // Шаг 3: Создание заказа в корзине
      await this.createOrder();
      
      this.status = 'COMPLETED';
      console.log(`Order ${this.orderId} completed successfully`);
      
    } catch (error) {
      console.error(`Order ${this.orderId} failed:`, error.message);
      await this.compensate();
      this.status = 'FAILED';
    }
  }

  async checkProductAvailability() {
    return new Promise((resolve, reject) => {
      const promises = this.items.map(item => {
        return new Promise((itemResolve, itemReject) => {
          productClient.GetProduct({ id: item.product_id }, (err, response) => {
            if (err) {
              itemReject(new Error(`Product ${item.product_id} not found`));
              return;
            }
            
            if (response.product.stock < item.quantity) {
              itemReject(new Error(`Insufficient stock for product ${item.product_id}`));
              return;
            }
            
            itemResolve(response.product);
          });
        });
      });

      Promise.all(promises)
        .then(() => {
          this.completedSteps.push('checkProductAvailability');
          resolve();
        })
        .catch(reject);
    });
  }

  async reserveProducts() {
    return new Promise((resolve, reject) => {
      const promises = this.items.map(item => {
        return new Promise((itemResolve, itemReject) => {
          const newStock = item.currentStock - item.quantity;
          productClient.UpdateProduct({
            id: item.product_id,
            name: item.name,
            description: item.description,
            price: item.price,
            stock: newStock,
            category: item.category
          }, (err, response) => {
            if (err) {
              itemReject(new Error(`Failed to reserve product ${item.product_id}`));
              return;
            }
            
            // Сохраняем оригинальное количество для компенсации
            item.originalStock = item.currentStock;
            itemResolve(response.product);
          });
        });
      });

      Promise.all(promises)
        .then(() => {
          this.completedSteps.push('reserveProducts');
          resolve();
        })
        .catch(reject);
    });
  }

  async createOrder() {
    return new Promise((resolve, reject) => {
      // Здесь можно добавить логику создания заказа
      // Пока просто помечаем как выполненный шаг
      this.completedSteps.push('createOrder');
      resolve();
    });
  }

  async compensate() {
    console.log(`Compensating order ${this.orderId}`);
    
    // Компенсация в обратном порядке
    const stepsToCompensate = [...this.completedSteps].reverse();
    
    for (const step of stepsToCompensate) {
      try {
        if (step === 'reserveProducts') {
          await this.compensateReserveProducts();
        }
        // Добавить другие компенсации по мере необходимости
        
        this.compensatedSteps.push(step);
      } catch (error) {
        console.error(`Failed to compensate step ${step}:`, error);
      }
    }
  }

  async compensateReserveProducts() {
    return new Promise((resolve, reject) => {
      const promises = this.items.map(item => {
        return new Promise((itemResolve, itemReject) => {
          productClient.UpdateProduct({
            id: item.product_id,
            name: item.name,
            description: item.description,
            price: item.price,
            stock: item.originalStock,
            category: item.category
          }, (err, response) => {
            if (err) {
              itemReject(new Error(`Failed to compensate product ${item.product_id}`));
              return;
            }
            itemResolve(response.product);
          });
        });
      });

      Promise.all(promises)
        .then(() => resolve())
        .catch(reject);
    });
  }
}

// Сервис оркестратора
class OrchestratorService {
  async processOrder(call, callback) {
    try {
      const { user_id, items } = call.request;
      const orderId = uuidv4();
      
      // Получаем информацию о товарах
      const productPromises = items.map(item => {
        return new Promise((resolve, reject) => {
          productClient.GetProduct({ id: item.product_id }, (err, response) => {
            if (err) {
              reject(new Error(`Product ${item.product_id} not found`));
              return;
            }
            resolve({
              ...item,
              name: response.product.name,
              description: response.product.description,
              price: response.product.price,
              category: response.product.category,
              currentStock: response.product.stock
            });
          });
        });
      });

      const enrichedItems = await Promise.all(productPromises);
      
      // Создаем и запускаем Saga
      const saga = new OrderSaga(orderId, user_id, enrichedItems);
      orderStates.set(orderId, saga);
      
      // Добавляем заказ в индекс пользователей
      if (!userOrders.has(user_id)) {
        userOrders.set(user_id, []);
      }
      userOrders.get(user_id).push(orderId);
      
      // Запускаем Saga асинхронно
      saga.execute().catch(error => {
        console.error(`Saga execution failed for order ${orderId}:`, error);
      });
      
      callback(null, {
        success: true,
        message: 'Order processing started',
        order_id: orderId,
        status: 'PROCESSING'
      });
      
    } catch (error) {
      console.error('Error processing order:', error);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Failed to process order'
      });
    }
  }

  async cancelOrder(call, callback) {
    try {
      const { order_id, user_id } = call.request;
      
      const saga = orderStates.get(order_id);
      if (!saga) {
        return callback({
          code: grpc.status.NOT_FOUND,
          details: 'Order not found'
        });
      }
      
      if (saga.userId !== user_id) {
        return callback({
          code: grpc.status.PERMISSION_DENIED,
          details: 'Access denied'
        });
      }
      
      // Запускаем компенсацию
      await saga.compensate();
      saga.status = 'CANCELLED';
      
      callback(null, {
        success: true,
        message: 'Order cancelled successfully'
      });
      
    } catch (error) {
      console.error('Error cancelling order:', error);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Failed to cancel order'
      });
    }
  }

  async getOrderStatus(call, callback) {
    try {
      const { order_id } = call.request;
      
      const saga = orderStates.get(order_id);
      if (!saga) {
        return callback({
          code: grpc.status.NOT_FOUND,
          details: 'Order not found'
        });
      }
      
      const totalAmount = saga.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      callback(null, {
        success: true,
        message: 'Order status retrieved successfully',
        status: saga.status,
        items: saga.items.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price
        })),
        total_amount: totalAmount
      });
      
    } catch (error) {
      console.error('Error getting order status:', error);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Failed to get order status'
      });
    }
  }

  async getUserOrders(call, callback) {
    try {
      const { user_id } = call.request;
      
      const userOrderIds = userOrders.get(user_id) || [];
      const orders = [];
      
      for (const orderId of userOrderIds) {
        const saga = orderStates.get(orderId);
        if (saga) {
          const totalAmount = saga.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
          orders.push({
            order_id: orderId,
            status: saga.status,
            items: saga.items.map(item => ({
              product_id: item.product_id,
              quantity: item.quantity,
              price: item.price
            })),
            total_amount: totalAmount,
            created_at: saga.created_at || new Date().toISOString()
          });
        }
      }
      
      // Сортируем по дате создания (новые сначала)
      orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      callback(null, {
        success: true,
        message: 'User orders retrieved successfully',
        orders,
        total: orders.length
      });
      
    } catch (error) {
      console.error('Error getting user orders:', error);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Failed to get user orders'
      });
    }
  }
}

// Создание и запуск gRPC сервера
const server = new grpc.Server();
const orchestratorService = new OrchestratorService();

server.addService(orchestratorProto.OrchestratorService.service, {
  ProcessOrder: orchestratorService.processOrder.bind(orchestratorService),
  CancelOrder: orchestratorService.cancelOrder.bind(orchestratorService),
  GetOrderStatus: orchestratorService.getOrderStatus.bind(orchestratorService),
  GetUserOrders: orchestratorService.getUserOrders.bind(orchestratorService)
});

const port = '0.0.0.0:50053';
server.bindAsync(port, grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) {
    console.error('Failed to start server:', err);
    return;
  }
  console.log(`Orchestrator service running on port ${port}`);
  server.start();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down Orchestrator service...');
  server.forceShutdown();
  process.exit(0);
});
