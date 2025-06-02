// scripts/create-project.js
// Script para crear proyectos desde línea de comandos

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Función principal
async function createProject(projectName, pdfPath) {
  return new Promise((resolve, reject) => {
    // Verificar que el archivo PDF existe
    if (!fs.existsSync(pdfPath)) {
      reject(new Error(`El archivo PDF no existe: ${pdfPath}`));
      return;
    }

    // Verificar que es un PDF
    if (!pdfPath.toLowerCase().endsWith('.pdf')) {
      reject(new Error('El archivo debe ser un PDF'));
      return;
    }

    const db = new sqlite3.Database('./database.db');
    
    // Crear directorio uploads si no existe
    const uploadsDir = './uploads';
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Generar nombre único para el archivo
    const originalName = path.basename(pdfPath);
    const uniqueFileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}.pdf`;
    const destinationPath = path.join(uploadsDir, uniqueFileName);

    try {
      // Copiar archivo PDF
      fs.copyFileSync(pdfPath, destinationPath);
      
      // Generar UUID del proyecto
      const projectUuid = uuidv4();

      // Insertar en base de datos
      const stmt = db.prepare(`
        INSERT INTO projects (name, uuid, pdf_filename, pdf_original_name)
        VALUES (?, ?, ?, ?)
      `);

      stmt.run([projectName, projectUuid, uniqueFileName, originalName], function(err) {
        if (err) {
          // Eliminar archivo si hay error en DB
          fs.unlinkSync(destinationPath);
          reject(err);
          return;
        }

        const projectInfo = {
          id: this.lastID,
          name: projectName,
          uuid: projectUuid,
          url: `/${encodeURIComponent(projectName)}/${projectUuid}`,
          pdf_filename: uniqueFileName,
          pdf_original_name: originalName
        };

        console.log('✅ Proyecto creado exitosamente:');
        console.log(`📝 Nombre: ${projectInfo.name}`);
        console.log(`🔗 URL: http://localhost:3001${projectInfo.url}`);
        console.log(`📄 PDF: ${projectInfo.pdf_original_name}`);
        console.log(`🆔 UUID: ${projectInfo.uuid}`);

        stmt.finalize();
        db.close();
        resolve(projectInfo);
      });

    } catch (err) {
      db.close();
      reject(err);
    }
  });
}

// Función para listar proyectos
function listProjects() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database('./database.db');
    
    db.all(
      'SELECT * FROM projects ORDER BY created_at DESC',
      [],
      (err, projects) => {
        db.close();
        
        if (err) {
          reject(err);
          return;
        }

        if (projects.length === 0) {
          console.log('📝 No hay proyectos creados aún');
          resolve([]);
          return;
        }

        console.log(`📋 Proyectos existentes (${projects.length}):\n`);
        
        projects.forEach((project, index) => {
          console.log(`${index + 1}. ${project.name}`);
          console.log(`   🔗 URL: http://localhost:3001/${encodeURIComponent(project.name)}/${project.uuid}`);
          console.log(`   📄 PDF: ${project.pdf_original_name}`);
          console.log(`   📅 Creado: ${new Date(project.created_at).toLocaleString()}`);
          console.log('');
        });

        resolve(projects);
      }
    );
  });
}

// Manejo de argumentos de línea de comandos
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === 'list') {
    // Listar proyectos
    listProjects().catch(err => {
      console.error('❌ Error:', err.message);
      process.exit(1);
    });
    
  } else if (args.length === 2) {
    // Crear proyecto
    const [projectName, pdfPath] = args;
    
    createProject(projectName, pdfPath)
      .then(() => {
        console.log('\n🎉 ¡Proyecto listo para recibir comentarios!');
        process.exit(0);
      })
      .catch(err => {
        console.error('❌ Error creando proyecto:', err.message);
        process.exit(1);
      });
      
  } else {
    console.log('📖 Uso:');
    console.log('  node scripts/create-project.js                     # Listar proyectos');
    console.log('  node scripts/create-project.js list                # Listar proyectos');
    console.log('  node scripts/create-project.js "Nombre" ruta.pdf   # Crear proyecto');
    console.log('');
    console.log('📝 Ejemplos:');
    console.log('  node scripts/create-project.js "Mi Proyecto" ./docs/documento.pdf');
    console.log('  node scripts/create-project.js "Revisión Q1" ~/Downloads/reporte.pdf');
    process.exit(1);
  }
}

module.exports = { createProject, listProjects };