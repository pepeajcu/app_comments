#!/bin/bash

# Script de despliegue para la aplicación PDF Comments

set -e

echo "🚀 Iniciando despliegue de PDF Comments App..."

# Crear directorios necesarios si no existen
echo "📁 Creando directorios necesarios..."
mkdir -p uploads
mkdir -p backups
touch database.db

# Construir la imagen Docker
echo "🏗️ Construyendo imagen Docker..."
docker-compose build

# Detener contenedores existentes
echo "🛑 Deteniendo contenedores existentes..."
docker-compose down

# Iniciar los servicios
echo "▶️ Iniciando servicios..."
docker-compose up -d

# Esperar a que los servicios estén listos
echo "⏳ Esperando a que los servicios estén listos..."
sleep 10

# Verificar el estado de los servicios
echo "🔍 Verificando estado de los servicios..."
docker-compose ps

# Mostrar logs recientes
echo "📋 Logs recientes:"
docker-compose logs --tail=20

echo ""
echo "✅ ¡Despliegue completado!"
echo "🌐 La aplicación está disponible en: http://localhost:3001"
echo "🔧 Panel de administración: http://localhost:3001/admin"
echo ""
echo "📖 Comandos útiles:"
echo "  Ver logs en tiempo real: docker-compose logs -f"
echo "  Detener servicios: docker-compose down"
echo "  Reiniciar servicios: docker-compose restart"
echo "  Ver estado: docker-compose ps"
echo ""