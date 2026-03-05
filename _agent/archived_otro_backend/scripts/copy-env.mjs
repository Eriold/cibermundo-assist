#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Copia .env.example a .env si .env no existe
 * @param {string} targetDir - Directorio donde está .env.example
 */
function copyEnvExample(targetDir) {
  const examplePath = path.join(targetDir, '.env.example');
  const envPath = path.join(targetDir, '.env');

  // Verificar si .env.example existe
  if (!fs.existsSync(examplePath)) {
    console.warn(`⚠️  .env.example no encontrado en ${targetDir}`);
    return false;
  }

  // Si .env ya existe, no sobrescribir
  if (fs.existsSync(envPath)) {
    console.log(`ℹ️  .env ya existe en ${targetDir}, omitiendo...`);
    return true;
  }

  // Copiar .env.example a .env
  try {
    fs.copyFileSync(examplePath, envPath);
    console.log(`✅ .env creado desde .env.example en ${targetDir}`);
    return true;
  } catch (error) {
    console.error(`❌ Error al copiar .env en ${targetDir}:`, error.message);
    return false;
  }
}

// Obtener el directorio target del argumento o usar el CWD
const targetDir = process.argv[2] || process.cwd();

const success = copyEnvExample(targetDir);
process.exit(success ? 0 : 1);
