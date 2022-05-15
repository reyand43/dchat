FROM node:16-alpine3.14

WORKDIR /app
COPY package*.json ./
RUN apk add --update python3 make g++ && rm -rf /var/cache/apk/*
RUN npm i

COPY . /app

EXPOSE 3000
CMD ["npm", "run", "build"]