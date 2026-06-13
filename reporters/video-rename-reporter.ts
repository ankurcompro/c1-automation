import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import fs from 'fs';
import path from 'path';

/**
 * Saves each test's video into `videos/` with a filename that starts with the
 * test-case ID (e.g. `TC-001`, `TC-NEW-2`) so recordings are easy to map back
 * to the test that produced them.
 *
 * Playwright's own video lives at `test-results/<hash>/video.webm`, which is
 * hard to identify by eye. This reporter copies (not moves) it — the original
 * is left in place so the HTML report's video link keeps working.
 *
 * Output name: `<TC-id>__<slugified title>[__retryN]__<status>.webm`
 */

const OUT_DIR = 'videos';

/** Pull the leading test-case ID out of a test title, e.g. "TC-NEW-2 ...". */
function testCaseId(title: string): string {
  const match = title.match(/\b(TC[-_][A-Za-z0-9-]+)/);
  return match ? match[1] : 'NO-ID';
}

function slug(text: string): string {
  return text
    .replace(/[^\w-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
}

class VideoRenameReporter implements Reporter {
  onTestEnd(test: TestCase, result: TestResult) {
    const video = result.attachments.find(
      (a) => a.name === 'video' && a.path,
    );
    if (!video?.path || !fs.existsSync(video.path)) return;

    const id = testCaseId(test.title);
    // Drop the leading TC-id from the title so it isn't repeated in the name.
    const desc = slug(test.title.replace(/^\s*TC[-_][A-Za-z0-9-]+\s*/, ''));
    const retry = result.retry > 0 ? `__retry${result.retry}` : '';
    const dest = path.join(
      OUT_DIR,
      `${id}__${desc}${retry}__${result.status}.webm`,
    );

    try {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      fs.copyFileSync(video.path, dest);
    } catch (err) {
      console.warn(`[video-rename] could not save video for ${id}: ${err}`);
    }
  }
}

export default VideoRenameReporter;
