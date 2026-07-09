FROM node:20-slim
WORKDIR /app
COPY . .
RUN npm install --prefix server --omit=dev
EXPOSE 3000
CMD ["npm", "start", "--prefix", "server"]
