FROM node:14.16.0
 
LABEL version="1.0"
LABEL description="This is the base docker for odmanagement API."
LABEL maintainer = ["sandhyasankar29@gmail.com"]
 
WORKDIR /ODMLMANAGEMENTSERVERSIDE
 
COPY ["package.json", "package-lock.json", "./"]
RUN ls
RUN npm install --production
COPY . .
 
EXPOSE 3001
 
CMD ["node", "server.js"]