-- Создание таблицы товаров
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    category VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание индексов
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

-- Вставка тестовых данных
INSERT INTO products (name, description, price, stock, category) VALUES
('iPhone 15', 'Новый iPhone с улучшенной камерой', 999.99, 50, 'Electronics'),
('MacBook Pro', 'Профессиональный ноутбук Apple', 1999.99, 25, 'Electronics'),
('Samsung Galaxy S24', 'Флагманский смартфон Samsung', 899.99, 30, 'Electronics'),
('Nike Air Max', 'Кроссовки Nike для спорта', 129.99, 100, 'Shoes'),
('Adidas Ultraboost', 'Беговые кроссовки Adidas', 149.99, 75, 'Shoes'),
('Levi\'s 501', 'Классические джинсы Levi\'s', 79.99, 200, 'Clothing'),
('Zara T-Shirt', 'Базовая футболка Zara', 19.99, 150, 'Clothing'),
('Sony WH-1000XM5', 'Беспроводные наушники Sony', 399.99, 40, 'Electronics'),
('Dell XPS 13', 'Ультрабук Dell', 1299.99, 20, 'Electronics'),
('Puma Classic', 'Классические кроссовки Puma', 89.99, 80, 'Shoes')
ON CONFLICT DO NOTHING;
