// scripts/healthcheck.js
// Script para verificar el estado de salud de la aplicación

const http = require('http');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || 'localhost';
const DB_PATH = process.env.DATABASE_PATH || './database.db';

// Códigos de salida para Docker health check
const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;

// Función para verificar la conectividad HTTP
function checkHttpHealth() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path: '/admin', // Verificar que el endpoint principal responde
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        resolve({ status: 'healthy', service: 'http', message: 'HTTP server responding' });
      } else {
        reject({ status: 'unhealthy', service: 'http', message: `HTTP server returned ${res.statusCode}` });
      }
    });

    req.on('timeout', () => {
      req.destroy();
      reject({ status: 'unhealthy', service: 'http', message: 'HTTP request timeout' });
    });

    req.on('error', (err) => {
      reject({ status: 'unhealthy', service: 'http', message: `HTTP error: ${err.message}` });
    });

    req.end();
  });
}

// Función para verificar la base de datos
function checkDatabaseHealth() {
  return new Promise((resolve, reject) => {
    // Verificar que el archivo de base de datos existe
    if (!fs.existsSync(DB_PATH)) {
      reject({ status: 'unhealthy', service: 'database', message: 'Database file not found' });
      return;
    }

    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY);

    // Ejecutar una consulta simple para verificar conectividad
    db.get('SELECT COUNT(*) as count FROM projects', (err, row) => {
      if (err) {
        reject({ status: 'unhealthy', service: 'database', message: `Database error: ${err.message}` });
      } else {
        resolve({ 
          status: 'healthy', 
          service: 'database', 
          message: 'Database accessible',
          data: { projectCount: row.count }
        });
      }

      db.close();
    });
  });
}

// Función para verificar el sistema de archivos
function checkFileSystemHealth() {
  return new Promise((resolve, reject) => {
    const uploadsDir = './uploads';

    // Verificar que el directorio de uploads existe y es escribible
    if (!fs.existsSync(uploadsDir)) {
      reject({ status: 'unhealthy', service: 'filesystem', message: 'Uploads directory not found' });
      return;
    }

    // Intentar crear un archivo temporal para verificar permisos de escritura
    const testFile = `${uploadsDir}/.healthcheck-${Date.now()}`;
    
    try {
      fs.writeFileSync(testFile, 'healthcheck test');
      fs.unlinkSync(testFile);
      
      // Obtener estadísticas del directorio
      const stats = fs.statSync(uploadsDir);
      const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.pdf'));
      
      resolve({ 
        status: 'healthy', 
        service: 'filesystem', 
        message: 'File system accessible',
        data: { 
          uploadsDir: uploadsDir,
          pdfCount: files.length,
          lastModified: stats.mtime
        }
      });
    } catch (err) {
      reject({ status: 'unhealthy', service: 'filesystem', message: `File system error: ${err.message}` });
    }
  });
}

// Función para verificar memoria y recursos del sistema
function checkSystemHealth() {
  return new Promise((resolve) => {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    // Convertir bytes a MB
    const memUsageMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    };

    // Verificar si el uso de memoria es razonable (menos de 500MB)
    const isMemoryHealthy = memUsageMB.rss < 500;
    
    resolve({
      status: isMemoryHealthy ? 'healthy' : 'warning',
      service: 'system',
      message: isMemoryHealthy ? 'System resources normal' : 'High memory usage detected',
      data: {
        uptime: Math.round(uptime),
        memoryUsageMB: memUsageMB,
        nodeVersion: process.version,
        platform: process.platform
      }
    });
  });
}

// Función principal de health check
async function performHealthCheck() {
  const checks = {
    http: null,
    database: null,
    filesystem: null,
    system: null
  };

  const results = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: require('../package.json').version,
    checks: checks
  };

  try {
    // Ejecutar todas las verificaciones
    const [httpResult, dbResult, fsResult, systemResult] = await Promise.allSettled([
      checkHttpHealth(),
      checkDatabaseHealth(),
      checkFileSystemHealth(),
      checkSystemHealth()
    ]);

    // Procesar resultados
    checks.http = httpResult.status === 'fulfilled' ? httpResult.value : httpResult.reason;
    checks.database = dbResult.status === 'fulfilled' ? dbResult.value : dbResult.reason;
    checks.filesystem = fsResult.status === 'fulfilled' ? fsResult.value : fsResult.reason;
    checks.system = systemResult.status === 'fulfilled' ? systemResult.value : systemResult.reason;

    // Determinar estado general
    const hasUnhealthy = Object.values(checks).some(check => check.status === 'unhealthy');
    const hasWarnings = Object.values(checks).some(check => check.status === 'warning');

    if (hasUnhealthy) {
      results.status = 'unhealthy';
    } else if (hasWarnings) {
      results.status = 'warning';
    }

  } catch (error) {
    results.status = 'error';
    results.error = error.message;
  }

  return results;
}

// Función para mostrar resultados en formato humano
function displayResults(results) {
  console.log('\n🏥 Health Check Report');
  console.log('='.repeat(50));
  console.log(`📅 Timestamp: ${results.timestamp}`);
  console.log(`📋 Version: ${results.version}`);
  console.log(`🟢 Overall Status: ${results.status.toUpperCase()}`);
  console.log();

  Object.entries(results.checks).forEach(([service, check]) => {
    const statusIcon = check.status === 'healthy' ? '✅' : 
                      check.status === 'warning' ? '⚠️' : '❌';
    
    console.log(`${statusIcon} ${service.toUpperCase()}: ${check.status}`);
    console.log(`   Message: ${check.message}`);
    
    if (check.data) {
      console.log(`   Data:`, JSON.stringify(check.data, null, 4));
    }
    console.log();
  });

  if (results.error) {
    console.log(`❌ Error: ${results.error}`);
  }
}

// Función para usar en Docker health check
function dockerHealthCheck() {
  performHealthCheck().then(results => {
    if (results.status === 'healthy') {
      console.log('HEALTHY');
      process.exit(EXIT_SUCCESS);
    } else {
      console.log(`UNHEALTHY: ${results.status}`);
      process.exit(EXIT_FAILURE);
    }
  }).catch(error => {
    console.log(`ERROR: ${error.message}`);
    process.exit(EXIT_FAILURE);
  });
}

// Función para mostrar resultados detallados
function detailedHealthCheck() {
  performHealthCheck().then(results => {
    displayResults(results);
    
    // Salir con código apropiado
    if (results.status === 'healthy') {
      process.exit(EXIT_SUCCESS);
    } else {
      process.exit(EXIT_FAILURE);
    }
  }).catch(error => {
    console.error(`❌ Health check failed: ${error.message}`);
    process.exit(EXIT_FAILURE);
  });
}

// Manejo de argumentos de línea de comandos
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('🏥 Health Check Script');
    console.log('');
    console.log('Uso:');
    console.log('  node scripts/healthcheck.js              # Health check detallado');
    console.log('  node scripts/healthcheck.js --docker     # Health check para Docker');
    console.log('  node scripts/healthcheck.js --json       # Salida en formato JSON');
    console.log('  node scripts/healthcheck.js --help       # Mostrar esta ayuda');
    console.log('');
    console.log('Códigos de salida:');
    console.log('  0 = Healthy (todo funcionando correctamente)');
    console.log('  1 = Unhealthy (se encontraron problemas)');
    process.exit(0);
  }

  if (args.includes('--docker')) {
    dockerHealthCheck();
  } else if (args.includes('--json')) {
    performHealthCheck().then(results => {
      console.log(JSON.stringify(results, null, 2));
      process.exit(results.status === 'healthy' ? EXIT_SUCCESS : EXIT_FAILURE);
    }).catch(error => {
      console.log(JSON.stringify({ status: 'error', error: error.message }, null, 2));
      process.exit(EXIT_FAILURE);
    });
  } else {
    detailedHealthCheck();
  }
}

module.exports = { performHealthCheck };