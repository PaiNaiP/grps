FROM node:18-alpine

WORKDIR /app

# Копируем package.json и устанавливаем зависимости
COPY services/product/package*.json ./
RUN npm install

# Копируем исходный код
COPY services/product/ .

# Копируем протобуфы
COPY proto ./proto

# Открываем порт
EXPOSE 50051

# Запускаем сервис
CMD ["npm", "start"]
