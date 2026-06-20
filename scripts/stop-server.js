#!/usr/bin/env node
// Kill whatever process is listening on the StudyLens port (default 3000).
// Cross-platform: uses netstat on Windows, lsof on macOS/Linux.
// Override the port with: PORT=4000 npm stop
const { execSync } = require('child_process');

const port = process.env.PORT || 3000;
const isWin = process.platform === 'win32';

function pidsOnPort(p) {
  try {
    if (isWin) {
      const out = execSync(`netstat -ano -p tcp`, { encoding: 'utf-8' });
      const pids = new Set();
      for (const line of out.split('\n')) {
        if (line.includes(`:${p} `) && /LISTENING/i.test(line)) {
          const pid = line.trim().split(/\s+/).pop();
          if (pid && /^\d+$/.test(pid)) pids.add(pid);
        }
      }
      return [...pids];
    }
    const out = execSync(`lsof -ti tcp:${p} -s tcp:LISTEN`, { encoding: 'utf-8' });
    return out.split('\n').map(s => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

const pids = pidsOnPort(port);
if (pids.length === 0) {
  console.log(`No process listening on port ${port}.`);
  process.exit(0);
}

for (const pid of pids) {
  try {
    execSync(isWin ? `taskkill /F /PID ${pid}` : `kill -9 ${pid}`, { stdio: 'ignore' });
    console.log(`Stopped process ${pid} on port ${port}.`);
  } catch (err) {
    console.error(`Failed to stop process ${pid}: ${err.message}`);
  }
}
