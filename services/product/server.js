const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

// Загрузка протобуфа
const packageDefinition = protoLoader.loadSync('./proto/product.proto', {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const productProto = grpc.loadPackageDefinition(packageDefinition).product;

// Настройка подключения к PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'products_db',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

// Функции для работы с базой данных
class ProductService {
  async createProduct(call, callback) {
    try {
      const { name, description, price, stock, category } = call.request;
      
      const query = `
        INSERT INTO products (id, name, description, price, stock, category)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      
      const id = uuidv4();
      const values = [id, name, description, price, stock, category];
      
      const result = await pool.query(query, values);
      const product = result.rows[0];
      
      callback(null, {
        success: true,
        message: 'Product created successfully',
        product: {
          id: product.id,
          name: product.name,
          description: product.description,
          price: parseFloat(product.price),
          stock: product.stock,
          category: product.category,
          created_at: product.created_at.toISOString(),
          updated_at: product.updated_at.toISOString()
        }
      });
    } catch (error) {
      console.error('Error creating product:', error);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Failed to create product'
      });
    }
  }

  async getProduct(call, callback) {
    try {
      const { id } = call.request;
      
      const query = 'SELECT * FROM products WHERE id = $1';
      const result = await pool.query(query, [id]);
      
      if (result.rows.length === 0) {
        return callback({
          code: grpc.status.NOT_FOUND,
          details: 'Product not found'
        });
      }
      
      const product = result.rows[0];
      
      callback(null, {
        success: true,
        message: 'Product retrieved successfully',
        product: {
          id: product.id,
          name: product.name,
          description: product.description,
          price: parseFloat(product.price),
          stock: product.stock,
          category: product.category,
          created_at: product.created_at.toISOString(),
          updated_at: product.updated_at.toISOString()
        }
      });
    } catch (error) {
      console.error('Error getting product:', error);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Failed to get product'
      });
    }
  }

  async updateProduct(call, callback) {
    try {
      const { id, name, description, price, stock, category } = call.request;
      
      const query = `
        UPDATE products 
        SET name = $2, description = $3, price = $4, stock = $5, category = $6, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;
      
      const values = [id, name, description, price, stock, category];
      const result = await pool.query(query, values);
      
      if (result.rows.length === 0) {
        return callback({
          code: grpc.status.NOT_FOUND,
          details: 'Product not found'
        });
      }
      
      const product = result.rows[0];
      
      callback(null, {
        success: true,
        message: 'Product updated successfully',
        product: {
          id: product.id,
          name: product.name,
          description: product.description,
          price: parseFloat(product.price),
          stock: product.stock,
          category: product.category,
          created_at: product.created_at.toISOString(),
          updated_at: product.updated_at.toISOString()
        }
      });
    } catch (error) {
      console.error('Error updating product:', error);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Failed to update product'
      });
    }
  }

  async deleteProduct(call, callback) {
    try {
      const { id } = call.request;
      
      const query = 'DELETE FROM products WHERE id = $1';
      const result = await pool.query(query, [id]);
      
      if (result.rowCount === 0) {
        return callback({
          code: grpc.status.NOT_FOUND,
          details: 'Product not found'
        });
      }
      
      callback(null, {
        success: true,
        message: 'Product deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting product:', error);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Failed to delete product'
      });
    }
  }

  async listProducts(call, callback) {
    try {
      const { page = 1, limit = 10, category } = call.request;
      // Убеждаемся, что page и limit являются числами
      const validPage = Number(page) || 1;
      const validLimit = Number(limit) || 10;
      const offset = (validPage - 1) * validLimit;
      
      let query = 'SELECT * FROM products';
      let countQuery = 'SELECT COUNT(*) FROM products';
      let values = [];
      
      if (category) {
        query += ' WHERE category = $1';
        countQuery += ' WHERE category = $1';
        values = [category];
      }
      
      query += ` ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
      values.push(validLimit, offset);
      
      const [productsResult, countResult] = await Promise.all([
        pool.query(query, values),
        pool.query(countQuery, category ? [category] : [])
      ]);
      
      const products = productsResult.rows.map(product => ({
        id: product.id,
        name: product.name,
        description: product.description,
        price: parseFloat(product.price),
        stock: product.stock,
        category: product.category,
        created_at: product.created_at.toISOString(),
        updated_at: product.updated_at.toISOString()
      }));
      
      callback(null, {
        products,
        total: parseInt(countResult.rows[0].count),
        page: validPage,
        limit: validLimit
      });
    } catch (error) {
      console.error('Error listing products:', error);
      callback({
        code: grpc.status.INTERNAL,
        details: 'Failed to list products'
      });
    }
  }
}

// Создание и запуск gRPC сервера
const server = new grpc.Server();
const productService = new ProductService();

server.addService(productProto.ProductService.service, {
  CreateProduct: productService.createProduct.bind(productService),
  GetProduct: productService.getProduct.bind(productService),
  UpdateProduct: productService.updateProduct.bind(productService),
  DeleteProduct: productService.deleteProduct.bind(productService),
  ListProducts: productService.listProducts.bind(productService)
});

const port = '0.0.0.0:50051';
server.bindAsync(port, grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) {
    console.error('Failed to start server:', err);
    return;
  }
  console.log(`Product service running on port ${port}`);
  server.start();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down Product service...');
  server.forceShutdown();
  pool.end();
  process.exit(0);
});
