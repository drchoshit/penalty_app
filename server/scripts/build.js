import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, "..", "src");
const outDir = path.join(__dirname, "..", "dist");

if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const item of fs.readdirSync(from)) {
    const src = path.join(from, item);
    const dst = path.join(to, item);
    const stat = fs.statSync(src);
    if (stat.isDirectory()) copyDir(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

// 단순 복사 빌드(ESM Node 실행). TS를 쓰지 않고 JS로 구성.
copyDir(srcDir, outDir);

console.log("server build complete:", outDir);
