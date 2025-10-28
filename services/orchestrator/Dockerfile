FROM node:18-alpine

WORKDIR /app

# Копируем package.json и устанавливаем зависимости
COPY services/orchestrator/package*.json ./
RUN npm install

# Копируем исходный код
COPY services/orchestrator/ .

# Копируем протобуфы
COPY proto ./proto

# Открываем порт
EXPOSE 50053

# Запускаем сервис
CMD ["npm", "start"]
