FROM node:18-alpine

# Tạo thư mục làm việc
WORKDIR /usr/src/app

# Chỉ copy file danh sách thư viện trước để tối ưu build
COPY package*.json ./

# Cài đặt thư viện (bỏ qua các thư viện lập trình dev)
RUN npm install --omit=dev

# Sau đó mới copy toàn bộ code vào
COPY . .

# Mở cổng 3000
EXPOSE 3000

# Chạy server
CMD ["node", "server.js"]