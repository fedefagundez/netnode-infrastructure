FROM node:20-slim
WORKDIR /app
COPY . .
RUN cd server && npm install --omit=dev
EXPOSE 3000
CMD ["sh", "-c", "cd server && npm start"]
