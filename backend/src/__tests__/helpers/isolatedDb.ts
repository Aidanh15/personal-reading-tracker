// Import first in a test file to give it its own throwaway database, so test
// files running in parallel never share one. Must precede any database import.
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

process.env['DATABASE_PATH'] = join(mkdtempSync(join(tmpdir(), 'reading-tracker-test-')), 'test.db');
