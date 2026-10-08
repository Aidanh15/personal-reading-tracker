// claude-bridge: lets the reading tracker's container talk to the Claude Code
// CLI installed on the Pi. Runs on the host as user pi (systemd unit
// claude-bridge.service), listening only on the Docker bridge address.
//
//   POST /turn   {sessionId, resume, systemPrompt, message}  (Bearer token)
//                → NDJSON: the CLI's stream-json lines, then one final
//                  {"type":"bridge_done"} or {"type":"bridge_error",code,message}
//   GET  /health → {ok, claudeVersion}
import { createServer } from 'node:http';
import { spawn, execFile } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { buildArgs, isSessionNotFound } from './cli.mjs';

const TOKEN = process.env.CLAUDE_BRIDGE_TOKEN;
const MODEL = process.env.CLAUDE_BRIDGE_MODEL || 'opus';
const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';
const HOST = process.env.BRIDGE_HOST || '172.17.0.1';
const PORT = Number(process.env.BRIDGE_PORT || 3010);
const TURN_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const WORK_DIR = join(homedir(), '.local', 'share', 'claude-bridge');

if (!TOKEN) {
    console.error('CLAUDE_BRIDGE_TOKEN is not set');
    process.exit(1);
}
mkdirSync(WORK_DIR, { recursive: true });

let claudeVersion = 'unknown';
execFile(CLAUDE_BIN, ['--version'], (error, stdout) => {
    if (!error) claudeVersion = stdout.trim();
});

let busy = false;

function authorized(req) {
    const given = Buffer.from(req.headers.authorization || '');
    const expected = Buffer.from(`Bearer ${TOKEN}`);
    return given.length === expected.length && timingSafeEqual(given, expected);
}

function sendJson(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        req.on('data', chunk => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                reject(new Error('Body too large'));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        req.on('error', reject);
    });
}

function validTurn(body) {
    return body && typeof body.sessionId === 'string' && /^[0-9a-f-]{36}$/i.test(body.sessionId) &&
        typeof body.resume === 'boolean' && typeof body.systemPrompt === 'string' &&
        typeof body.message === 'string' && body.message.length > 0;
}

function runTurn(turn, res) {
    busy = true;
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' });

    const child = spawn(CLAUDE_BIN, buildArgs({ ...turn, model: MODEL }), {
        cwd: WORK_DIR,
        stdio: ['pipe', 'pipe', 'pipe']
    });
    let finished = false;
    let errorText = '';
    let pending = '';
    let timedOut = false;

    const finish = line => {
        if (finished) return;
        finished = true;
        busy = false;
        clearTimeout(timer);
        if (!res.writableEnded) res.end(`${JSON.stringify(line)}\n`);
    };

    const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
    }, TURN_TIMEOUT_MS);

    const forward = text => {
        pending += text;
        let newline;
        while ((newline = pending.indexOf('\n')) !== -1) {
            const line = pending.slice(0, newline).trim();
            pending = pending.slice(newline + 1);
            if (!line) continue;
            try {
                JSON.parse(line);
                if (!res.writableEnded) res.write(`${line}\n`);
            } catch {
                errorText += `${line}\n`;
            }
        }
    };

    child.stdout.setEncoding('utf-8').on('data', forward);
    child.stderr.setEncoding('utf-8').on('data', text => { errorText += text; });

    child.on('error', error => {
        finish({ type: 'bridge_error', code: 'cli_failed', message: error.message });
    });
    child.on('close', code => {
        forward('\n');
        if (timedOut) {
            finish({ type: 'bridge_error', code: 'timeout', message: 'Claude took longer than 5 minutes' });
        } else if (code === 0) {
            finish({ type: 'bridge_done' });
        } else {
            finish({
                type: 'bridge_error',
                code: isSessionNotFound(errorText) ? 'session_not_found' : 'cli_failed',
                message: errorText.trim().slice(-500) || `claude exited with code ${code}`
            });
        }
    });

    // The backend went away before the turn finished: stop the CLI.
    res.on('close', () => {
        if (!finished) child.kill('SIGTERM');
    });

    child.stdin.on('error', () => { /* reported via close */ });
    child.stdin.end(turn.message);
}

const server = createServer(async (req, res) => {
    try {
        if (req.method === 'GET' && req.url === '/health') {
            sendJson(res, 200, { ok: true, claudeVersion });
            return;
        }
        if (req.method !== 'POST' || req.url !== '/turn') {
            sendJson(res, 404, { error: 'Not found' });
            return;
        }
        if (!authorized(req)) {
            sendJson(res, 401, { error: 'Unauthorized' });
            return;
        }

        let body;
        try {
            body = JSON.parse(await readBody(req));
        } catch {
            sendJson(res, 400, { error: 'Invalid JSON body' });
            return;
        }
        if (!validTurn(body)) {
            sendJson(res, 400, { error: 'Expected {sessionId, resume, systemPrompt, message}' });
            return;
        }
        if (busy) {
            sendJson(res, 409, { error: 'busy' });
            return;
        }
        runTurn(body, res);
    } catch (error) {
        console.error('Bridge request failed:', error);
        if (!res.headersSent) sendJson(res, 500, { error: 'Internal error' });
        else res.end();
    }
});

server.listen(PORT, HOST, () => {
    console.log(`claude-bridge listening on ${HOST}:${PORT} (model ${MODEL})`);
});
