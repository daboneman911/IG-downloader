import { spawn } from 'node:child_process';

export class ProcError extends Error {
  constructor(message, { code, stderr, timedOut } = {}) {
    super(message);
    this.code = code;
    this.stderr = stderr;
    this.timedOut = timedOut;
  }
}

/**
 * Run a binary with an argv array (never a shell string, so URLs can't inject commands).
 * Kills the process on timeout or when `signal` aborts (e.g. the client disconnected).
 */
export function run(bin, args, { timeoutMs = 60_000, signal, maxStdout = 64 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const out = [];
    let outLen = 0;
    let err = '';
    let timedOut = false;

    const kill = () => {
      if (child.exitCode === null) child.kill('SIGKILL');
    };
    const timer = setTimeout(() => {
      timedOut = true;
      kill();
    }, timeoutMs);
    signal?.addEventListener('abort', kill, { once: true });

    child.stdout.on('data', (d) => {
      outLen += d.length;
      if (outLen > maxStdout) return kill();
      out.push(d);
    });
    // Keep only the tail of stderr; yt-dlp can be chatty and the last lines carry the error.
    child.stderr.on('data', (d) => {
      err = (err + d.toString()).slice(-8000);
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new ProcError(`failed to start ${bin}: ${e.message}`, { code: e.code }));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', kill);
      if (code === 0) return resolve({ stdout: Buffer.concat(out).toString('utf8'), stderr: err });
      reject(
        new ProcError(timedOut ? `${bin} timed out` : `${bin} exited with code ${code}`, {
          code,
          stderr: err,
          timedOut,
        }),
      );
    });
  });
}
