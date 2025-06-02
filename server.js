// server.js - Backend para la aplicación de comentarios en PDF
const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range'],
  exposedHeaders: ['Accept-Ranges', 'Content-Length', 'Content-Range', 'Content-Encoding']
}));

app.use(express.json());
app.use(express.static('public'));

// Configurar headers específicos para archivos PDF
app.use('/uploads', (req, res, next) => {
  // Headers necesarios para PDF.js
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Range, Content-Range');
  res.header('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Encoding, Content-Length, Content-Range');
  
  // Permitir requests de rango para PDFs grandes
  if (req.path.endsWith('.pdf')) {
    res.header('Accept-Ranges', 'bytes');
  }
  
  next();
}, express.static('uploads'));

// Configurar multer para subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}.pdf`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB límite
  }
});

// Inicializar base de datos SQLite
const db = new sqlite3.Database('./database.db');

// Crear tablas si no existen
db.serialize(() => {
  // Tabla de proyectos
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      uuid TEXT UNIQUE NOT NULL,
      pdf_filename TEXT NOT NULL,
      pdf_original_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de comentarios (actualizada con nuevos campos)
  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      parent_id INTEGER DEFAULT NULL,
      text TEXT NOT NULL,
      rect_x INTEGER NOT NULL,
      rect_y INTEGER NOT NULL,
      rect_width INTEGER NOT NULL,
      rect_height INTEGER NOT NULL,
      color TEXT NOT NULL,
      approved BOOLEAN DEFAULT FALSE,
      page INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES comments (id) ON DELETE CASCADE
    )
  `);

  // Migrar tabla existente si es necesaria (agregar columnas nuevas)
  db.run(`ALTER TABLE comments ADD COLUMN parent_id INTEGER DEFAULT NULL`, () => {});
  db.run(`ALTER TABLE comments ADD COLUMN approved BOOLEAN DEFAULT FALSE`, () => {});
  db.run(`ALTER TABLE comments ADD COLUMN page INTEGER DEFAULT 1`, () => {});
});

// RUTAS DE LA API

// 1. Crear nuevo proyecto
app.post('/api/projects', upload.single('pdf'), (req, res) => {
  try {
    const { name } = req.body;
    const file = req.file;

    if (!name || !file) {
      return res.status(400).json({ 
        error: 'Nombre del proyecto y archivo PDF son requeridos' 
      });
    }

    const projectUuid = uuidv4();

    const stmt = db.prepare(`
      INSERT INTO projects (name, uuid, pdf_filename, pdf_original_name)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run([name, projectUuid, file.filename, file.originalname], function(err) {
      if (err) {
        console.error('Error al crear proyecto:', err);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }

      res.json({
        success: true,
        project: {
          id: this.lastID,
          name,
          uuid: projectUuid,
          url: `/${name}/${projectUuid}`,
          pdf_url: `/uploads/${file.filename}`
        }
      });
    });

    stmt.finalize();
  } catch (error) {
    console.error('Error al procesar la subida:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 2. Obtener proyecto por UUID
app.get('/api/projects/:uuid', (req, res) => {
  const { uuid } = req.params;

  db.get(
    'SELECT * FROM projects WHERE uuid = ?',
    [uuid],
    (err, project) => {
      if (err) {
        console.error('Error al obtener proyecto:', err);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }

      if (!project) {
        return res.status(404).json({ error: 'Proyecto no encontrado' });
      }

      res.json({
        success: true,
        project: {
          id: project.id,
          name: project.name,
          uuid: project.uuid,
          pdf_url: `/uploads/${project.pdf_filename}`,
          pdf_original_name: project.pdf_original_name,
          created_at: project.created_at
        }
      });
    }
  );
});

// 3. Obtener comentarios de un proyecto (actualizado para soportar respuestas)
app.get('/api/projects/:uuid/comments', (req, res) => {
  const { uuid } = req.params;

  // Primero obtener el ID del proyecto
  db.get(
    'SELECT id FROM projects WHERE uuid = ?',
    [uuid],
    (err, project) => {
      if (err) {
        console.error('Error al obtener proyecto:', err);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }

      if (!project) {
        return res.status(404).json({ error: 'Proyecto no encontrado' });
      }

      // Obtener comentarios con estructura jerárquica
      db.all(
        'SELECT * FROM comments WHERE project_id = ? ORDER BY created_at ASC',
        [project.id],
        (err, comments) => {
          if (err) {
            console.error('Error al obtener comentarios:', err);
            return res.status(500).json({ error: 'Error interno del servidor' });
          }

          const formattedComments = comments.map(comment => ({
            id: comment.id,
            text: comment.text,
            rect: {
              x: comment.rect_x,
              y: comment.rect_y,
              width: comment.rect_width,
              height: comment.rect_height
            },
            color: comment.color,
            approved: comment.approved || false,
            page: comment.page || 1,
            parent_id: comment.parent_id,
            timestamp: new Date(comment.created_at).toLocaleTimeString(),
            created_at: comment.created_at
          }));

          res.json({
            success: true,
            comments: formattedComments
          });
        }
      );
    }
  );
});

// 4. Agregar comentario a un proyecto (actualizado)
app.post('/api/projects/:uuid/comments', (req, res) => {
  const { uuid } = req.params;
  const { text, rect, color, page, parent_id } = req.body;

  if (!text || (!rect && !parent_id) || !color) {
    return res.status(400).json({ 
      error: 'Texto y color son requeridos. Rectángulo es requerido para comentarios principales.' 
    });
  }

  // Para respuestas, usar el rectángulo del comentario padre si no se proporciona
  let finalRect = rect;
  if (parent_id && !rect) {
    // Obtener rectángulo del comentario padre
    db.get(
      'SELECT rect_x, rect_y, rect_width, rect_height FROM comments WHERE id = ?',
      [parent_id],
      (err, parentComment) => {
        if (err || !parentComment) {
          return res.status(400).json({ error: 'Comentario padre no encontrado' });
        }
        
        finalRect = {
          x: parentComment.rect_x,
          y: parentComment.rect_y,
          width: parentComment.rect_width,
          height: parentComment.rect_height
        };
        
        proceedWithCommentCreation();
      }
    );
    return;
  }

  proceedWithCommentCreation();

  function proceedWithCommentCreation() {
    // Validar estructura del rectángulo
    if (!finalRect || !finalRect.x || !finalRect.y || !finalRect.width || !finalRect.height) {
      return res.status(400).json({ 
        error: 'Rectángulo debe tener x, y, width y height' 
      });
    }

    // Obtener ID del proyecto
    db.get(
      'SELECT id FROM projects WHERE uuid = ?',
      [uuid],
      (err, project) => {
        if (err) {
          console.error('Error al obtener proyecto:', err);
          return res.status(500).json({ error: 'Error interno del servidor' });
        }

        if (!project) {
          return res.status(404).json({ error: 'Proyecto no encontrado' });
        }

        // Insertar comentario
        const stmt = db.prepare(`
          INSERT INTO comments (project_id, parent_id, text, rect_x, rect_y, rect_width, rect_height, color, page)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run([
          project.id,
          parent_id || null,
          text,
          finalRect.x,
          finalRect.y,
          finalRect.width,
          finalRect.height,
          color,
          page || 1
        ], function(err) {
          if (err) {
            console.error('Error al agregar comentario:', err);
            return res.status(500).json({ error: 'Error interno del servidor' });
          }

          res.json({
            success: true,
            comment: {
              id: this.lastID,
              text,
              rect: finalRect,
              color,
              approved: false,
              page: page || 1,
              parent_id: parent_id || null,
              timestamp: new Date().toLocaleTimeString()
            }
          });
        });

        stmt.finalize();
      }
    );
  }
});

// 5. Actualizar comentario
app.put('/api/comments/:commentId', (req, res) => {
  const { commentId } = req.params;
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Texto es requerido' });
  }

  const stmt = db.prepare(
    'UPDATE comments SET text = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  );

  stmt.run([text, commentId], function(err) {
    if (err) {
      console.error('Error al actualizar comentario:', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Comentario no encontrado' });
    }

    res.json({
      success: true,
      message: 'Comentario actualizado correctamente'
    });
  });

  stmt.finalize();
});

// 6. Aprobar/desaprobar comentario (nueva ruta)
app.put('/api/comments/:commentId/approve', (req, res) => {
  const { commentId } = req.params;
  const { approved } = req.body;

  const stmt = db.prepare(
    'UPDATE comments SET approved = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  );

  stmt.run([approved ? 1 : 0, commentId], function(err) {
    if (err) {
      console.error('Error al aprobar comentario:', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Comentario no encontrado' });
    }

    res.json({
      success: true,
      message: approved ? 'Comentario aprobado' : 'Aprobación removida'
    });
  });

  stmt.finalize();
});

// 7. Eliminar comentario
app.delete('/api/comments/:commentId', (req, res) => {
  const { commentId } = req.params;

  const stmt = db.prepare('DELETE FROM comments WHERE id = ?');

  stmt.run([commentId], function(err) {
    if (err) {
      console.error('Error al eliminar comentario:', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Comentario no encontrado' });
    }

    res.json({
      success: true,
      message: 'Comentario eliminado correctamente'
    });
  });

  stmt.finalize();
});

// 8. Listar todos los proyectos con contador de comentarios (actualizado)
app.get('/api/projects', (req, res) => {
  db.all(`
    SELECT 
      p.*,
      COUNT(c.id) as comment_count
    FROM projects p
    LEFT JOIN comments c ON p.id = c.project_id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `, [], (err, projects) => {
    if (err) {
      console.error('Error al obtener proyectos:', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    const formattedProjects = projects.map(project => ({
      id: project.id,
      name: project.name,
      uuid: project.uuid,
      url: `/${project.name}/${project.uuid}`,
      pdf_url: `/uploads/${project.pdf_filename}`,
      pdf_original_name: project.pdf_original_name,
      created_at: project.created_at,
      comment_count: project.comment_count || 0
    }));

    res.json({
      success: true,
      projects: formattedProjects
    });
  });
});

// 9. Ruta para eliminar proyecto
app.delete('/api/projects/:uuid', (req, res) => {
  const { uuid } = req.params;

  // Primero obtener el nombre del archivo PDF para eliminarlo
  db.get(
    'SELECT pdf_filename FROM projects WHERE uuid = ?',
    [uuid],
    (err, project) => {
      if (err) {
        console.error('Error al buscar proyecto:', err);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }

      if (!project) {
        return res.status(404).json({ error: 'Proyecto no encontrado' });
      }

      // Eliminar el archivo PDF del sistema de archivos
      const filePath = path.join(__dirname, 'uploads', project.pdf_filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`Archivo PDF eliminado: ${project.pdf_filename}`);
        } catch (fileErr) {
          console.error('Error al eliminar archivo PDF:', fileErr);
          // Continuar con la eliminación de la base de datos aunque falle el archivo
        }
      }

      // Eliminar proyecto de la base de datos (esto también elimina comentarios por CASCADE)
      const stmt = db.prepare('DELETE FROM projects WHERE uuid = ?');
      
      stmt.run([uuid], function(err) {
        if (err) {
          console.error('Error al eliminar proyecto:', err);
          return res.status(500).json({ error: 'Error interno del servidor' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Proyecto no encontrado' });
        }

        res.json({
          success: true,
          message: 'Proyecto eliminado correctamente'
        });
      });

      stmt.finalize();
    }
  );
});

// 10. Ruta para servir el panel de administración
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 11. Ruta para servir la aplicación React en las URLs de proyecto
app.get('/:projectName/:uuid', (req, res) => {
  const { uuid } = req.params;
  
  // Verificar que el proyecto existe
  db.get(
    'SELECT id FROM projects WHERE uuid = ?',
    [uuid],
    (err, project) => {
      if (err || !project) {
        return res.status(404).send('Proyecto no encontrado');
      }
      
      // Servir el archivo HTML principal de React
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
  );
});

// Manejar errores de multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'El archivo es demasiado grande. Máximo 10MB.' });
    }
  }
  res.status(500).json({ error: error.message });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📁 Base de datos: ./database.db`);
  console.log(`📂 Archivos PDF: ./uploads/`);
  console.log(`🔧 Panel de administración: http://localhost:${PORT}/admin`);
});

// Manejar cierre graceful
process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando servidor...');
  db.close((err) => {
    if (err) {
      console.error('Error al cerrar la base de datos:', err);
    } else {
      console.log('✅ Base de datos cerrada correctamente');
    }
    process.exit(0);
  });
});