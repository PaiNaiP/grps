const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Загрузка протобуфа
const packageDefinition = protoLoader.loadSync('./proto/cart.proto', {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const cartProto = grpc.loadPackageDefinition(packageDefinition).cart;

// Загрузка клиента для Product Service
const productPackageDefinition = protoLoader.loadSync('./proto/product.proto', {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const productProto = grpc.loadPackageDefinition(productPackageDefinition).product;

// Настройка подключения к PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'cart_db',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5433,
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Создание клиента для Product Service
const productClient = new productProto.ProductService(
  process.env.PRODUCT_SERVICE_URL || 'localhost:50051',
  grpc.credentials.createInsecure()
);

// Функции для работы с базой данных
class CartService {
  async registerUser(call, callback) {
    try {
      const { email, password, name, phone, address } = call.request;
      
      // Проверяем, существует ли пользователь
      const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUser.rows.length > 0) {
        return callback({
          code: grpc.status.ALREADY_EXISTS,
          details: 'User with this email already exists'
        });
      }
      
      // Хешируем пароль
      const passwordHash = await bcrypt.hash(password, 10);
      
      const query = `
        INSERT INTO users (id, email, password_hash, name, phone, address)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, email, name, phone, address, created_at, updated_at
      `;
      
      const id = uuidv4();
      const values = [id, email, passwordHash, name, phone, address];
      
      const result = await pool.query(query, values);
      const user = result.rows[0];
      
      callback(null, {
        success: true,
        message: 'User registered successfully',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          address: user.address,
          created_at: user.created_at.toISOString(),
          updated_at: user.updated_at.toISOString()
        }
      });
    } catch (error) {
      console.error('Error registering user:', error);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Failed to register user'
      });
    }
  }

  async loginUser(call, callback) {
    try {
      const { email, password } = call.request;
      
      const query = 'SELECT * FROM users WHERE email = $1';
      const result = await pool.query(query, [email]);
      
      if (result.rows.length === 0) {
        return callback({
          code: grpc.status.NOT_FOUND,
          details: 'User not found'
        });
      }
      
      const user = result.rows[0];
      
      // Проверяем пароль
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return callback({
          code: grpc.status.UNAUTHENTICATED,
          details: 'Invalid password'
        });
      }
      
      // Создаем JWT токен
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      callback(null, {
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          address: user.address,
          created_at: user.created_at.toISOString(),
          updated_at: user.updated_at.toISOString()
        }
      });
    } catch (error) {
      console.error('Error logging in user:', error);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Failed to login user'
      });
    }
  }

  async getUser(call, callback) {
    try {
      const { user_id } = call.request;
      
      const query = 'SELECT id, email, name, phone, address, created_at, updated_at FROM users WHERE id = $1';
      const result = await pool.query(query, [user_id]);
      
      if (result.rows.length === 0) {
        return callback({
          code: grpc.status.NOT_FOUND,
          details: 'User not found'
        });
      }
      
      const user = result.rows[0];
      
      callback(null, {
        success: true,
        message: 'User retrieved successfully',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          address: user.address,
          created_at: user.created_at.toISOString(),
          updated_at: user.updated_at.toISOString()
        }
      });
    } catch (error) {
      console.error('Error getting user:', error);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Failed to get user'
      });
    }
  }

  async updateUser(call, callback) {
    try {
      const { user_id, name, phone, address } = call.request;
      
      const query = `
        UPDATE users 
        SET name = $2, phone = $3, address = $4, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, email, name, phone, address, created_at, updated_at
      `;
      
      const values = [user_id, name, phone, address];
      const result = await pool.query(query, values);
      
      if (result.rows.length === 0) {
        return callback({
          code: grpc.status.NOT_FOUND,
          details: 'User not found'
        });
      }
      
      const user = result.rows[0];
      
      callback(null, {
        success: true,
        message: 'User updated successfully',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          address: user.address,
          created_at: user.created_at.toISOString(),
          updated_at: user.updated_at.toISOString()
        }
      });
    } catch (error) {
      console.error('Error updating user:', error);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Failed to update user'
      });
    }
  }

  async addToCart(call, callback) {
    try {
      const { user_id, product_id, quantity } = call.request;
      
      // Получаем актуальную цену товара из Product Service
      const productInfo = await new Promise((resolve, reject) => {
        productClient.GetProduct({ id: product_id }, (err, response) => {
          if (err) {
            reject(new Error(`Product ${product_id} not found`));
            return;
          }
          resolve(response.product);
        });
      });
      
      const actualPrice = productInfo.price;
      
      // Проверяем, есть ли уже этот товар в корзине
      const existingItem = await pool.query(
        'SELECT * FROM cart_items WHERE user_id = $1 AND product_id = $2',
        [user_id, product_id]
      );
      
      if (existingItem.rows.length > 0) {
        // Обновляем количество и цену существующего товара
        const newQuantity = existingItem.rows[0].quantity + quantity;
        const query = `
          UPDATE cart_items 
          SET quantity = $3, price = $4, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $1 AND product_id = $2
          RETURNING *
        `;
        
        const result = await pool.query(query, [user_id, product_id, newQuantity, actualPrice]);
        const cartItem = result.rows[0];
        
        callback(null, {
          success: true,
          message: 'Cart item updated successfully',
          cart_item: {
            id: cartItem.id,
            user_id: cartItem.user_id,
            product_id: cartItem.product_id,
            quantity: cartItem.quantity,
            price: parseFloat(cartItem.price),
            created_at: cartItem.created_at.toISOString(),
            updated_at: cartItem.updated_at.toISOString()
          }
        });
      } else {
        // Добавляем новый товар в корзину
        const query = `
          INSERT INTO cart_items (id, user_id, product_id, quantity, price)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `;
        
        const id = uuidv4();
        const values = [id, user_id, product_id, quantity, actualPrice];
        
        const result = await pool.query(query, values);
        const cartItem = result.rows[0];
        
        callback(null, {
          success: true,
          message: 'Item added to cart successfully',
          cart_item: {
            id: cartItem.id,
            user_id: cartItem.user_id,
            product_id: cartItem.product_id,
            quantity: cartItem.quantity,
            price: parseFloat(cartItem.price),
            created_at: cartItem.created_at.toISOString(),
            updated_at: cartItem.updated_at.toISOString()
          }
        });
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Failed to add item to cart'
      });
    }
  }

  async removeFromCart(call, callback) {
    try {
      const { user_id, product_id } = call.request;
      
      // Валидация входных данных
      if (!user_id || !product_id) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          details: 'user_id and product_id are required'
        });
      }
      
      const query = 'DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2';
      const result = await pool.query(query, [user_id, product_id]);
      
      if (result.rowCount === 0) {
        return callback({
          code: grpc.status.NOT_FOUND,
          details: `Cart item not found for user ${user_id} and product ${product_id}`
        });
      }
      
      callback(null, {
        success: true,
        message: 'Item removed from cart successfully'
      });
    } catch (error) {
      console.error('Error removing from cart:', error);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Failed to remove item from cart'
      });
    }
  }

  async updateCartItem(call, callback) {
    try {
      const { user_id, product_id, quantity } = call.request;
      console.log(product_id);
      // Валидация входных данных
      if (user_id == null || product_id == null || quantity == null) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          details: 'user_id, product_id, and quantity are required'
        });
      }
      
      
      console.log(`UpdateCartItem: user_id=${user_id}, product_id=${product_id}, quantity=${quantity}`);
      console.log(`UpdateCartItem: user_id type=${typeof user_id}, product_id type=${typeof product_id}, quantity type=${typeof quantity}`);
      console.log(`UpdateCartItem: user_id length=${user_id?.length}, product_id length=${product_id?.length}`);
      
      if (quantity <= 0) {
        // Если количество <= 0, удаляем товар из корзины
        return this.removeFromCart(call, callback);
      }
      
      const query = `
        UPDATE cart_items 
        SET quantity = $3, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND product_id = $2
        RETURNING *
      `;
      
      const values = [user_id, product_id, quantity];
      console.log(`SQL Query: ${query}`);
      console.log(`SQL Values:`, values);
      
      const result = await pool.query(query, values);
      console.log(`SQL Result rows: ${result.rows.length}`);
      
      if (result.rows.length === 0) {
        return callback({
          code: grpc.status.NOT_FOUND,
          details: `Cart item not found for user ${user_id} and product ${product_id}`
        });
      }
      
      const cartItem = result.rows[0];
      
      callback(null, {
        success: true,
        message: 'Cart item updated successfully',
        cart_item: {
          id: cartItem.id,
          user_id: cartItem.user_id,
          product_id: cartItem.product_id,
          quantity: cartItem.quantity,
          price: parseFloat(cartItem.price),
          created_at: cartItem.created_at.toISOString(),
          updated_at: cartItem.updated_at.toISOString()
        }
      });
    } catch (error) {
      console.error('Error updating cart item:', error);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Failed to update cart item'
      });
    }
  }

  async getCart(call, callback) {
    try {
      const { user_id } = call.request;
      
      const query = 'SELECT * FROM cart_items WHERE user_id = $1 ORDER BY created_at DESC';
      const result = await pool.query(query, [user_id]);
      
      const cartItems = result.rows.map(item => ({
        id: item.id,
        user_id: item.user_id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: parseFloat(item.price),
        created_at: item.created_at.toISOString(),
        updated_at: item.updated_at.toISOString()
      }));
      
      // Вычисляем общую сумму
      const totalAmount = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      callback(null, {
        success: true,
        message: 'Cart retrieved successfully',
        cart_items: cartItems,
        total_amount: totalAmount
      });
    } catch (error) {
      console.error('Error getting cart:', error);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Failed to get cart'
      });
    }
  }

  async clearCart(call, callback) {
    try {
      const { user_id } = call.request;
      
      const query = 'DELETE FROM cart_items WHERE user_id = $1';
      await pool.query(query, [user_id]);
      
      callback(null, {
        success: true,
        message: 'Cart cleared successfully'
      });
    } catch (error) {
      console.error('Error clearing cart:', error);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Failed to clear cart'
      });
    }
  }
}

// Создание и запуск gRPC сервера
const server = new grpc.Server();
const cartService = new CartService();

server.addService(cartProto.CartService.service, {
  RegisterUser: cartService.registerUser.bind(cartService),
  LoginUser: cartService.loginUser.bind(cartService),
  GetUser: cartService.getUser.bind(cartService),
  UpdateUser: cartService.updateUser.bind(cartService),
  AddToCart: cartService.addToCart.bind(cartService),
  RemoveFromCart: cartService.removeFromCart.bind(cartService),
  UpdateCartItem: cartService.updateCartItem.bind(cartService),
  GetCart: cartService.getCart.bind(cartService),
  ClearCart: cartService.clearCart.bind(cartService)
});

const port = '0.0.0.0:50052';
server.bindAsync(port, grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) {
    console.error('Failed to start server:', err);
    return;
  }
  console.log(`Cart service running on port ${port}`);
  server.start();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down Cart service...');
  server.forceShutdown();
  pool.end();
  process.exit(0);
});
