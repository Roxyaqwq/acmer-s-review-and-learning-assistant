const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = __dirname;
const LOG = path.join(ROOT, 'launcher.log');

function log(msg) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG, line + '\n');
}

fs.writeFileSync(LOG, '');

let backendProc = null;
let frontendProc = null;

function cleanup() {
  log('正在停止所有服务...');
  if (frontendProc) { try { frontendProc.kill(); } catch {} }
  if (backendProc) { try { backendProc.kill(); } catch {} }
  
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

// Start backend
const backendExe = path.join(ROOT, 'backend', 'main.exe');
if (!fs.existsSync(backendExe)) {
  log('错误: 找不到 backend/main.exe,请先编译后端');
  log('运行: cd backend && go build -o main.exe ./cmd/main.go');
  process.exit(1);
}

backendProc = spawn(backendExe, [], {
  cwd: path.join(ROOT, 'backend'),
  stdio: 'pipe',
  shell: false,
});

backendProc.stderr.on('data', (d) => { log('Backend: ' + d.toString().trim()); });
backendProc.on('error', (err) => { log('后端启动错误: ' + err.message); cleanup(); });
backendProc.on('exit', (code) => {
  if (code !== null && code !== 0) log('后端异常退出,代码: ' + code);
});

// Start frontend
frontendProc = spawn('cmd', ['/c', 'npm run dev'], {
  cwd: path.join(ROOT, 'frontend'),
  stdio: 'pipe',
});

frontendProc.stderr.on('data', (d) => { log('Frontend: ' + d.toString().trim()); });
frontendProc.on('error', (err) => { log('前端启动错误: ' + err.message); cleanup(); });
frontendProc.on('exit', (code) => {
  if (code !== null && code !== 0) log('前端异常退出,代码: ' + code);
});

// Wait for both ports
let checks = 0;
const timer = setInterval(() => {
  checks++;
  try {
    const netstat = execSync('netstat -ano', { encoding: 'utf8' });
    const b = netstat.includes(':8080') && netstat.includes('LISTENING');
    const f = netstat.includes(':3000') && netstat.includes('LISTENING');
    
    if (checks === 5 && !b) log('后端仍在启动...');
    if (checks === 10 && !f) log('前端仍在启动...');
    
    if (b && f) {
      clearInterval(timer);
      log('');
      log('========================================');
      log('  AlgoArena 已启动!');
      log('  前端: http://localhost:3000');
      log('  后端: http://localhost:8080');
      log('  Ctrl+C 停止所有服务');
      log('========================================');
      log('');
      try { execSync('start http://localhost:3000', { stdio: 'ignore' }); } catch {}
    }
  } catch (e) {
    log('端口检查错误: ' + e.message);
  }
  
  if (checks > 40) {
    clearInterval(timer);
    log('启动超时,请检查日志');
    cleanup();
  }
}, 2000);
