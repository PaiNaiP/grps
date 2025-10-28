FROM node:18-alpine

WORKDIR /app

# Копируем package.json и устанавливаем зависимости
COPY services/cart/package*.json ./
RUN npm install

# Копируем исходный код
COPY services/cart/ .

# Копируем протобуфы
COPY proto ./proto

# Открываем порт
EXPOSE 50052

# Запускаем сервис
CMD ["npm", "start"]
