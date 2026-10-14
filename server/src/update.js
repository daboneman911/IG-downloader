import { pathToFileURL } from 'node:url';
import { config } from './config.js';
import { run } from './proc.js';

// `yt-dlp -U` self-updates the standalone release binary in place (the Docker image and the
// winget/scoop installs use it). A pip-installed yt-dlp refuses and must be updated with pip.
export async function updateYtdlp() {
  try {
    const { stdout, stderr } = await run(config.ytdlpPath, ['-U'], { timeoutMs: 120_000 });
    console.log('[yt-dlp update]', (stdout + stderr).trim().split('\n').pop());
    return true;
  } catch (e) {
    console.warn('[yt-dlp update] failed:', (e.stderr || e.message).trim().split('\n').pop());
    return false;
  }
}

export function scheduleUpdates() {
  if (!config.ytdlpUpdateHours) return;
  updateYtdlp();
  setInterval(updateYtdlp, config.ytdlpUpdateHours * 3_600_000).unref();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = (await updateYtdlp()) ? 0 : 1;
}
