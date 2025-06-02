# Usar imagen base de Node.js
FROM node:18-alpine

# Crear directorio de la aplicación
WORKDIR /usr/src/app

# Copiar package.json y package-lock.json (si existe)
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar el resto del código de la aplicación
COPY . .

# Crear directorios necesarios
RUN mkdir -p uploads public

# Exponer el puerto
EXPOSE 3001

# Crear usuario no root para seguridad
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Cambiar permisos de directorios
RUN chown -R nextjs:nodejs /usr/src/app
RUN chmod -R 755 /usr/src/app

# Cambiar a usuario no root
USER nextjs

# Comando para iniciar la aplicación
CMD ["npm", "start"]