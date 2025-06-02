// scripts/init-db.js
// Script para inicializar la base de datos desde cero

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = './database.db';

// Función para crear la base de datos
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    console.log('🔧 Inicializando base de datos...');

    // Eliminar base de datos existente si existe
    if (fs.existsSync(DB_PATH)) {
      console.log('🗑️ Eliminando base de datos existente...');
      fs.unlinkSync(DB_PATH);
    }

    const db = new sqlite3.Database(DB_PATH);

    db.serialize(() => {
      console.log('📋 Creando tabla de proyectos...');
      
      // Tabla de proyectos
      db.run(`
        CREATE TABLE projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          uuid TEXT UNIQUE NOT NULL,
          pdf_filename TEXT NOT NULL,
          pdf_original_name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('❌ Error creando tabla projects:', err);
          reject(err);
          return;
        }
        console.log('✅ Tabla projects creada');
      });

      console.log('💬 Creando tabla de comentarios...');
      
      // Tabla de comentarios con todas las columnas necesarias
      db.run(`
        CREATE TABLE comments (
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
      `, (err) => {
        if (err) {
          console.error('❌ Error creando tabla comments:', err);
          reject(err);
          return;
        }
        console.log('✅ Tabla comments creada');
      });

      // Crear índices para mejorar rendimiento
      console.log('📈 Creando índices...');
      
      db.run('CREATE INDEX idx_projects_uuid ON projects(uuid)', (err) => {
        if (err) console.error('⚠️ Error creando índice projects_uuid:', err);
        else console.log('✅ Índice projects_uuid creado');
      });

      db.run('CREATE INDEX idx_comments_project_id ON comments(project_id)', (err) => {
        if (err) console.error('⚠️ Error creando índice comments_project_id:', err);
        else console.log('✅ Índice comments_project_id creado');
      });

      db.run('CREATE INDEX idx_comments_parent_id ON comments(parent_id)', (err) => {
        if (err) console.error('⚠️ Error creando índice comments_parent_id:', err);
        else console.log('✅ Índice comments_parent_id creado');
      });

      db.run('CREATE INDEX idx_comments_page ON comments(page)', (err) => {
        if (err) console.error('⚠️ Error creando índice comments_page:', err);
        else console.log('✅ Índice comments_page creado');
      });
    });

    db.close((err) => {
      if (err) {
        console.error('❌ Error cerrando base de datos:', err);
        reject(err);
        return;
      }
      
      console.log('🎉 Base de datos inicializada correctamente');
      console.log(`📁 Ubicación: ${path.resolve(DB_PATH)}`);
      resolve();
    });
  });
}

// Función para crear datos de ejemplo (opcional)
function createSampleData() {
  return new Promise((resolve, reject) => {
    console.log('📝 Creando datos de ejemplo...');

    const db = new sqlite3.Database(DB_PATH);
    
    // Nota: Este es solo un ejemplo, no incluye archivos PDF reales
    const sampleProject = {
      name: 'Proyecto de Ejemplo',
      uuid: 'ejemplo-uuid-1234',
      pdf_filename: 'ejemplo.pdf',
      pdf_original_name: 'Documento de Ejemplo.pdf'
    };

    db.run(`
      INSERT INTO projects (name, uuid, pdf_filename, pdf_original_name)
      VALUES (?, ?, ?, ?)
    `, [sampleProject.name, sampleProject.uuid, sampleProject.pdf_filename, sampleProject.pdf_original_name], 
    function(err) {
      if (err) {
        console.error('❌ Error insertando proyecto de ejemplo:', err);
        reject(err);
        return;
      }

      const projectId = this.lastID;
      console.log('✅ Proyecto de ejemplo creado con ID:', projectId);

      // Agregar comentario de ejemplo
      db.run(`
        INSERT INTO comments (project_id, text, rect_x, rect_y, rect_width, rect_height, color, page)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [projectId, 'Este es un comentario de ejemplo', 100, 150, 200, 100, '#4CAF50', 1],
      function(err) {
        if (err) {
          console.error('❌ Error insertando comentario de ejemplo:', err);
          reject(err);
          return;
        }

        console.log('✅ Comentario de ejemplo creado');
        
        db.close((err) => {
          if (err) {
            console.error('❌ Error cerrando base de datos:', err);
            reject(err);
            return;
          }
          resolve();
        });
      });
    });
  });
}

// Función principal
async function main() {
  const args = process.argv.slice(2);
  const includeSampleData = args.includes('--sample-data');

  try {
    // Crear directorio uploads si no existe
    const uploadsDir = './uploads';
    if (!fs.existsSync(uploadsDir)) {
      console.log('📁 Creando directorio uploads...');
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('✅ Directorio uploads creado');
    }

    // Inicializar base de datos
    await initializeDatabase();

    // Crear datos de ejemplo si se solicita
    if (includeSampleData) {
      await createSampleData();
      console.log('📊 Datos de ejemplo creados');
      console.log('⚠️ Nota: El proyecto de ejemplo no incluye un archivo PDF real');
    }

    console.log('\n🎉 ¡Inicialización completada!');
    console.log('📖 Para crear un proyecto real, usa:');
    console.log('   node scripts/create-project.js "Nombre del Proyecto" ruta/al/archivo.pdf');
    
  } catch (error) {
    console.error('❌ Error durante la inicialización:', error);
    process.exit(1);
  }
}

// Manejo de argumentos de línea de comandos
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('📖 Uso:');
    console.log('  node scripts/init-db.js                    # Inicializar base de datos vacía');
    console.log('  node scripts/init-db.js --sample-data      # Incluir datos de ejemplo');
    console.log('  node scripts/init-db.js --help             # Mostrar esta ayuda');
    console.log('');
    console.log('⚠️ ADVERTENCIA: Este script eliminará la base de datos existente');
    process.exit(0);
  }

  // Confirmación antes de proceder
  if (!args.includes('--yes')) {
    console.log('⚠️ ADVERTENCIA: Este script eliminará la base de datos existente.');
    console.log('¿Estás seguro de que quieres continuar? (y/N)');
    
    process.stdin.setEncoding('utf8');
    process.stdin.on('readable', () => {
      const chunk = process.stdin.read();
      if (chunk !== null) {
        const response = chunk.trim().toLowerCase();
        if (response === 'y' || response === 'yes') {
          main();
        } else {
          console.log('❌ Operación cancelada');
          process.exit(0);
        }
      }
    });
  } else {
    main();
  }
}

module.exports = { initializeDatabase, createSampleData };