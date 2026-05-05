import { access, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const venvDir = path.join(repoRoot, ".tmp/krx-chart-font-venv");
const venvPython = process.platform === "win32"
  ? path.join(venvDir, "Scripts/python.exe")
  : path.join(venvDir, "bin/python");

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function run(command, args) {
  return execFileAsync(command, args, {
    cwd: repoRoot,
    maxBuffer: 32 * 1024 * 1024
  });
}

function commandError(error) {
  return [error.message, error.stderr && String(error.stderr).trim(), error.stdout && String(error.stdout).trim()]
    .filter(Boolean)
    .join("\n");
}

async function hasPillow(pythonPath) {
  try {
    await run(pythonPath, ["-c", "import PIL"]);
    return true;
  } catch {
    return false;
  }
}

export async function ensureKrChartFontPython() {
  await mkdir(path.dirname(venvDir), { recursive: true });

  if (!(await exists(venvPython))) {
    try {
      await run("python3", ["-m", "venv", venvDir]);
    } catch (error) {
      throw new Error(`failed to create chart font Python venv at ${venvDir}: ${commandError(error)}`);
    }
  }

  if (!(await hasPillow(venvPython))) {
    try {
      await run(venvPython, ["-m", "pip", "install", "Pillow"]);
    } catch (error) {
      throw new Error(`failed to install Pillow into ${venvDir}: ${commandError(error)}`);
    }
  }

  if (!(await hasPillow(venvPython))) {
    throw new Error(`Pillow is unavailable in chart font Python venv at ${venvDir}`);
  }

  return venvPython;
}

export const krChartFontVenvDir = venvDir;
