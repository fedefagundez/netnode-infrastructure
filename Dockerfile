FROM node:20-slim
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm install --omit=dev
COPY server/ .
COPY client/ ../client/
COPY index.html ../index.html
EXPOSE 3000
CMD ["npm", "start"]
