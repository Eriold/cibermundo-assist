import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const npmExecpath = process.env.npm_execpath;

const packageConfigs = {
  backend: {
    cwd: path.join(repoRoot, "backend"),
    tasks: [
      {
        label: "esbuild",
        type: "node",
        script: "node_modules/esbuild/install.js",
      },
      {
        label: "better-sqlite3",
        type: "npm",
        args: ["rebuild", "better-sqlite3", "--ignore-scripts=false"],
        requiredPath: "node_modules/better-sqlite3/package.json",
      },
      {
        label: "puppeteer",
        type: "node",
        script: "node_modules/puppeteer/install.mjs",
      },
    ],
  },
  worker: {
    cwd: path.join(repoRoot, "worker"),
    tasks: [
      {
        label: "esbuild",
        type: "node",
        script: "node_modules/esbuild/install.js",
      },
      {
        label: "better-sqlite3",
        type: "npm",
        args: ["rebuild", "better-sqlite3", "--ignore-scripts=false"],
        requiredPath: "node_modules/better-sqlite3/package.json",
      },
      {
        label: "playwright chromium",
        type: "node",
        script: "node_modules/playwright/cli.js",
        args: ["install", "chromium"],
      },
    ],
  },
  frontend: {
    cwd: path.join(repoRoot, "frontend"),
    tasks: [
      {
        label: "@swc/core",
        type: "node",
        script: "node_modules/@swc/core/postinstall.js",
        env: (cwd) => ({ INIT_CWD: cwd }),
      },
      {
        label: "esbuild",
        type: "node",
        script: "node_modules/esbuild/install.js",
      },
    ],
  },
};

const requestedPackages = process.argv.slice(2);
const packagesToProcess = requestedPackages.length > 0 ? requestedPackages : Object.keys(packageConfigs);

for (const packageName of packagesToProcess) {
  const config = packageConfigs[packageName];
  if (!config) {
    console.error(
      `Paquete no soportado: ${packageName}. Usa uno de: ${Object.keys(packageConfigs).join(", ")}.`
    );
    process.exit(1);
  }

  if (!existsSync(path.join(config.cwd, "package.json"))) {
    console.error(`No existe ${packageName}/package.json en ${config.cwd}.`);
    process.exit(1);
  }

  if (!existsSync(path.join(config.cwd, "node_modules"))) {
    console.error(`Falta ${packageName}/node_modules. Ejecuta npm install antes de npm run install:trusted.`);
    process.exit(1);
  }

  for (const task of config.tasks) {
    const requiredPath = task.requiredPath ?? task.script;
    if (requiredPath && !existsSync(path.join(config.cwd, requiredPath))) {
      console.error(`No se encontro ${requiredPath} en ${packageName}. Verifica la instalacion de dependencias.`);
      process.exit(1);
    }

    console.log(`[${packageName}] Ejecutando allowlist: ${task.label}`);

    const command =
      task.type === "npm" ? (npmExecpath ? process.execPath : npmCmd) : process.execPath;
    const args =
      task.type === "npm"
        ? [...(npmExecpath ? [npmExecpath] : []), ...task.args]
        : [path.join(config.cwd, task.script), ...(task.args ?? [])];
    const env = {
      ...process.env,
      ...(typeof task.env === "function" ? task.env(config.cwd) : task.env),
    };

    const result = spawnSync(command, args, {
      cwd: config.cwd,
      env,
      stdio: "inherit",
    });

    if (result.error) {
      console.error(result.error);
      process.exit(1);
    }

    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}
