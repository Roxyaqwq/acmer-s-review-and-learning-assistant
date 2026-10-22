const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const ROOT = __dirname;
const LOG = path.join(ROOT, 'launcher.log');
const FRONTEND_DIR = path.join(ROOT, 'frontend');
const BUILD_ID = path.join(FRONTEND_DIR, '.next', 'BUILD_ID');
const SRC_DIR = path.join(FRONTEND_DIR, 'src');

const DEV_MODE = process.env.ALGOARENA_DEV === '1';
const PROBE_TIMEOUT_MS = 120 * 1000;

function log(msg) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG, line + '\n');
}

fs.writeFileSync(LOG, '');

let backendProc = null;
let frontendProc = null;
let shuttingDown = false;

function cleanup() {
  if (shuttingDown) return;
  shuttingDown = true;
  log('正在停止所有服务...');
  try { if (frontendProc) frontendProc.kill(); } catch {}
  try { if (backendProc) backendProc.kill(); } catch {}

  try {
    execSync('powershell -Command "Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"', { stdio: 'ignore' });
    execSync('powershell -Command "Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"', { stdio: 'ignore' });
  } catch {}

  log('已停止');
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Ensure PostgreSQL
try {
  execSync('powershell -Command "Get-Process -Name \'postgres\' -ErrorAction SilentlyContinue"', { stdio: 'ignore' });
  log('PostgreSQL 已运行');
} catch {
  log('警告: PostgreSQL 可能未运行,请确保已启动');
}

// Kill old processes
try {
  execSync('powershell -Command "Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"', { stdio: 'ignore' });
  execSync('powershell -Command "Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"', { stdio: 'ignore' });
} catch {}

log('AlgoArena 启动中...');

// ---- Backend（源码有变更时自动编译，避免改代码后运行旧版本 main.exe） ----
const backendExe = path.join(ROOT, 'backend', 'main.exe');

// 检测 backend 下源码（.go/go.mod/go.sum 等，排除 .exe 产物）是否晚于 main.exe
// 只认代码文件：backend/uploads 里上传一张头像不该触发重新编译。
function backendSrcNewerThanExe() {
  try {
    const exeMtime = fs.statSync(backendExe).mtimeMs;
    let latest = 0;
    const isSource = (name) => name.endsWith('.go') || name === 'go.mod' || name === 'go.sum';
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name.startsWith('.')) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (isSource(e.name)) {
          const m = fs.statSync(p).mtimeMs;
          if (m > latest) latest = m;
        }
      }
    };
    walk(path.join(ROOT, 'backend'));
    return latest > exeMtime;
  } catch {
    return true; // 状态获取失败时保守执行编译
  }
}

const exeExists = fs.existsSync(backendExe);
const needBackendBuild = !exeExists || backendSrcNewerThanExe();
if (!exeExists) {
  log('未找到 backend/main.exe, 正在编译后端...');
} else if (needBackendBuild) {
  log('检测到后端源码变更, 正在重新编译...');
} else {
  log('后端源码无变更, 跳过编译');
}

if (needBackendBuild) {
  try {
    execSync('go build -o main.exe ./cmd/main.go', { cwd: path.join(ROOT, 'backend'), stdio: 'pipe' });
    log('后端编译完成');
  } catch (e) {
    log('后端编译失败: ' + (e.stderr ? e.stderr.toString().trim() : e.message));
    if (!fs.existsSync(backendExe)) {
      log('错误: 无可用后端程序 (backend/main.exe 不存在)，请修复编译错误后重试');
      process.exit(1);
    }
    log('警告: 将使用旧版本 main.exe 启动，可能缺少新增路由');
  }
}

backendProc = spawn(backendExe, [], {
  cwd: path.join(ROOT, 'backend'),
  stdio: 'pipe',
  shell: false,
});

backendProc.stdout.on('data', (d) => { log('Backend: ' + d.toString().trim()); });
backendProc.stderr.on('data', (d) => { log('Backend: ' + d.toString().trim()); });
backendProc.on('error', (err) => { log('后端启动错误: ' + err.message); cleanup(); });
backendProc.on('exit', (code) => {
  if (code !== null && code !== 0) log('后端异常退出,代码: ' + code);
});

// ---- Frontend (默认生产模式, ALGOARENA_DEV=1 回退开发模式) ----
function spawnNpm(script) {
  const proc = spawn('cmd', ['/c', 'npm run ' + script], {
    cwd: FRONTEND_DIR,
    stdio: 'pipe',
  });
  proc.stdout.on('data', (d) => { log('Frontend: ' + d.toString().trim()); });
  proc.stderr.on('data', (d) => { log('Frontend: ' + d.toString().trim()); });
  proc.on('error', (err) => { log('前端启动错误: ' + err.message); cleanup(); });
  proc.on('exit', (code) => {
    if (code !== null && code !== 0) log('前端进程退出,代码: ' + code);
  });
  return proc;
}

// 检测 frontend/src 是否存在晚于构建产物的变更（仅提示，不自动重建）
function srcNewerThanBuild() {
  try {
    const buildMtime = fs.statSync(BUILD_ID).mtimeMs;
    let latest = 0;
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else {
          const m = fs.statSync(p).mtimeMs;
          if (m > latest) latest = m;
        }
      }
    };
    walk(SRC_DIR);
    return latest > buildMtime;
  } catch {
    return false;
  }
}

function startFrontend() {
  if (DEV_MODE) {
    log('开发模式 (ALGOARENA_DEV=1): 以 next dev 启动前端');
    frontendProc = spawnNpm('dev');
    return;
  }

  if (fs.existsSync(BUILD_ID)) {
    log('检测到生产构建产物 (.next/BUILD_ID), 以 next start 启动前端');
    if (srcNewerThanBuild()) {
      log('提示: 检测到 frontend/src 代码变更晚于构建产物, 生产模式需重新构建 (删除 frontend/.next 后重启, 或设置 ALGOARENA_DEV=1 进入开发模式)');
    }
    frontendProc = spawnNpm('start');
    return;
  }

  log('未检测到生产构建产物, 首次启动需构建, 预计 1-3 分钟...');
  const buildProc = spawn('cmd', ['/c', 'npm run build'], {
    cwd: FRONTEND_DIR,
    stdio: 'pipe',
  });
  buildProc.stdout.on('data', (d) => { log('Build: ' + d.toString().trim()); });
  buildProc.stderr.on('data', (d) => { log('Build: ' + d.toString().trim()); });
  buildProc.on('exit', (code) => {
    if (code === 0 && fs.existsSync(BUILD_ID)) {
      log('构建完成, 以 next start 启动前端');
      frontendProc = spawnNpm('start');
    } else {
      log('警告: 构建失败, 回退 dev 模式启动前端');
      frontendProc = spawnNpm('dev');
    }
  });
  buildProc.on('error', (err) => {
    log('构建启动错误: ' + err.message + ', 回退 dev 模式');
    frontendProc = spawnNpm('dev');
  });
}

startFrontend();

// ---- HTTP 健康探测（替代 netstat 端口扫描，确保双服务真实可响应） ----
function probe(url) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 3000 }, (res) => {
      res.resume();
      resolve(res.statusCode || 0);
    });
    req.on('error', () => resolve(0));
    req.on('timeout', () => { req.destroy(); resolve(0); });
  });
}

let probeStart = null; // 探测计时起点（前端进程启动后才开始计时，构建阶段不计入）
let buildTicks = 0;
let backendStaleWarned = false;

const timer = setInterval(async () => {
  // 一次性构建阶段不计入探测超时
  const building = !DEV_MODE && !frontendProc;
  if (building) {
    buildTicks++;
    if (buildTicks % 30 === 0) log('仍在构建中...');
    return;
  }
  if (probeStart === null) probeStart = Date.now();

  const [b, f] = await Promise.all([
    probe('http://localhost:8080/api/health'),
    probe('http://localhost:3000'),
  ]);

  // 后端在运行但 /api/health 404：main.exe 为旧版本（缺少健康检查路由）
  if (b === 404 && !backendStaleWarned) {
    backendStaleWarned = true;
    log('警告: /api/health 返回 404, 后端 main.exe 可能是旧版本。launcher 启动时已自动编译, 若仍出现请手动执行: cd backend && go build -o main.exe ./cmd/main.go');
  }

  if (b === 200 && f === 200) {
    clearInterval(timer);
    log('');
    log('========================================');
    log('  AlgoArena 已启动! (' + (DEV_MODE ? '开发模式' : '生产模式') + ')');
    log('  前端: http://localhost:3000');
    log('  后端: http://localhost:8080');
    log('  Ctrl+C 停止所有服务');
    if (!DEV_MODE) {
      log('  提示: 生产模式下前端代码变更需删除 frontend/.next 重新构建;');
      log('  开发调试请设置环境变量 ALGOARENA_DEV=1 后启动');
    }
    log('========================================');
    log('');
    try { execSync('start http://localhost:3000', { stdio: 'ignore' }); } catch {}
    return;
  }

  if (Date.now() - probeStart > PROBE_TIMEOUT_MS) {
    clearInterval(timer);
    log('启动超时,请检查日志');
    cleanup();
  }
}, 1000);
