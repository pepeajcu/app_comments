# 📝 PDF Comments App

Una aplicación web moderna para agregar comentarios interactivos en documentos PDF. Permite a los usuarios seleccionar áreas específicas del PDF y agregar comentarios que se visualizan en tiempo real.

## ✨ Características Principales

- **Visualización de PDF**: Renderizado completo de documentos PDF con soporte para múltiples páginas
- **Comentarios Interactivos**: Selección de áreas mediante clic y arrastre para agregar comentarios
- **Gestión de Comentarios**: Editar, eliminar y navegar entre comentarios
- **Panel de Administración**: Interface completa para gestionar proyectos
- **Exportación**: Descarga de comentarios en formato JSON
- **Responsive Design**: Interfaz adaptable a diferentes dispositivos
- **Base de Datos Local**: Almacenamiento persistente con SQLite

## 🚀 Demo

### Interfaz Principal
- **Panel Izquierdo**: Visualizador de PDF con herramientas de selección
- **Panel Derecho**: Lista de comentarios con opciones de edición
- **Interacción**: Selecciona un área del PDF arrastrando el mouse para crear un comentario

### Panel de Administración
- Crear nuevos proyectos subiendo archivos PDF
- Ver lista completa de proyectos existentes
- Copiar URLs de proyectos para compartir
- Eliminar proyectos y archivos asociados

## 🛠️ Tecnologías Utilizadas

### Backend
- **Node.js** + **Express.js**: Servidor web y API REST
- **SQLite3**: Base de datos ligera y sin configuración
- **Multer**: Manejo de subida de archivos
- **UUID**: Generación de identificadores únicos
- **CORS**: Soporte para peticiones cross-origin

### Frontend
- **React 18**: Interfaz de usuario reactiva
- **PDF.js**: Renderizado de documentos PDF
- **Tailwind CSS**: Styling moderno y responsive
- **Babel**: Transpilación de JSX en el navegador

## 📋 Requisitos del Sistema

- **Node.js** >= 14.0.0
- **NPM** >= 6.0.0
- Navegador web moderno con soporte para ES6+

## ⚡ Instalación Rápida

1. **Clonar el repositorio**
```bash
git clone https://github.com/tu-usuario/pdf-comments-app.git
cd pdf-comments-app
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Iniciar el servidor**
```bash
npm start
```

4. **Abrir la aplicación**
   - Panel de administración: http://localhost:3001/admin
   - Aplicación principal: http://localhost:3001

## 📁 Estructura del Proyecto

```
app_comments/
├── 📄 package.json           # Dependencias y scripts
├── 🗄️ database.db           # Base de datos SQLite
├── 🖥️ server.js             # Servidor Express principal
├── 📁 public/               # Archivos estáticos
│   ├── 🏠 index.html        # Aplicación principal React
│   └── ⚙️ admin.html        # Panel de administración
├── 📁 scripts/              # Utilidades
│   └── 🔧 create-project.js # Script para crear proyectos via CLI
└── 📁 uploads/              # Archivos PDF subidos
```

## 🎯 Uso de la Aplicación

### Crear un Nuevo Proyecto

**Opción 1: Panel de Administración**
1. Visita http://localhost:3001/admin
2. Haz clic en "Nuevo Proyecto"
3. Ingresa el nombre del proyecto
4. Selecciona un archivo PDF (máximo 10MB)
5. Haz clic en "Crear Proyecto"

**Opción 2: Línea de Comandos**
```bash
# Crear proyecto
npm run create-project "Mi Proyecto" "./documento.pdf"

# Listar proyectos existentes
npm run create-project list
```

### Agregar Comentarios

1. Abre la URL del proyecto generada
2. En el visualizador PDF, mantén presionado el clic y arrastra para seleccionar un área
3. Escribe tu comentario en el diálogo que aparece
4. Haz clic en "Agregar Comentario"

### Gestionar Comentarios

- **Ver comentarios**: Aparecen numerados en el PDF y listados en el panel derecho
- **Editar**: Haz clic en el ícono de edición (✏️) en el panel de comentarios
- **Eliminar**: Haz clic en el ícono de eliminar (🗑️)
- **Navegar**: Haz clic en un comentario del panel para ir a su ubicación en el PDF

## 🔌 API Endpoints

### Proyectos
```http
GET    /api/projects           # Listar todos los proyectos
POST   /api/projects          # Crear nuevo proyecto
GET    /api/projects/:uuid    # Obtener proyecto específico
DELETE /api/projects/:uuid    # Eliminar proyecto
```

### Comentarios
```http
GET    /api/projects/:uuid/comments    # Obtener comentarios del proyecto
POST   /api/projects/:uuid/comments    # Agregar comentario
PUT    /api/comments/:id               # Actualizar comentario
DELETE /api/comments/:id               # Eliminar comentario
```

## 🗃️ Base de Datos

### Tabla `projects`
- `id`: INTEGER PRIMARY KEY
- `name`: TEXT (nombre del proyecto)
- `uuid`: TEXT UNIQUE (identificador único)
- `pdf_filename`: TEXT (nombre del archivo)
- `pdf_original_name`: TEXT (nombre original)
- `created_at`: DATETIME
- `updated_at`: DATETIME

### Tabla `comments`
- `id`: INTEGER PRIMARY KEY
- `project_id`: INTEGER (FK a projects)
- `text`: TEXT (contenido del comentario)
- `rect_x`, `rect_y`, `rect_width`, `rect_height`: INTEGER (coordenadas)
- `color`: TEXT (color del comentario)
- `created_at`: DATETIME
- `updated_at`: DATETIME

## 🔧 Scripts Disponibles

```bash
npm start          # Iniciar servidor de producción
npm run dev        # Iniciar con nodemon (desarrollo)
npm run create-project  # Ejecutar script de creación de proyectos
```

## 🎨 Personalización

### Colores de Comentarios
Los comentarios se asignan automáticamente con colores rotativos:
- Verde: `#4CAF50`
- Azul: `#2196F3`
- Naranja: `#FF9800`
- Púrpura: `#9C27B0`
- Rojo: `#F44336`

### Configuración del Servidor
Puedes modificar el puerto y otras configuraciones editando las variables en `server.js`:
```javascript
const PORT = process.env.PORT || 3001;
```

## 🐛 Solución de Problemas

### El PDF no se carga
- Verifica que el archivo PDF esté en la carpeta `uploads/`
- Asegúrate de que el navegador soporte PDF.js
- Revisa la consola del navegador para errores específicos

### Error de CORS
- El servidor está configurado para permitir todas las origins
- Si tienes problemas, verifica la configuración CORS en `server.js`

### Base de datos bloqueada
```bash
# Reiniciar el servidor y eliminar locks
rm database.db-journal  # si existe
npm start
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver `LICENSE` para más detalles.

## 🆘 Soporte

Si encuentras algún problema o tienes preguntas:

1. **Issues**: Abre un issue en GitHub describiendo el problema
2. **Documentación**: Revisa este README y los comentarios en el código
3. **Logs**: Revisa la consola del servidor para mensajes de error detallados

---

⭐ **¡Si te gusta este proyecto, no olvides darle una estrella en GitHub!**

**Desarrollado con ❤️ usando Node.js y React**