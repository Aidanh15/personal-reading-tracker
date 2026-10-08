// Pure helpers for the bridge: how `claude -p` is invoked and how its errors read.

const TOOLS = 'WebSearch,WebFetch';

/**
 * Arguments for one discussion turn. The reader's message is written to stdin,
 * never passed here. The system prompt is sent on every turn because the CLI
 * does not keep it with the session.
 */
export function buildArgs({ sessionId, resume, systemPrompt, model }) {
    return [
        '-p',
        resume ? '--resume' : '--session-id', sessionId,
        '--output-format', 'stream-json',
        '--include-partial-messages',
        '--verbose',
        '--tools', TOOLS,
        '--allowedTools', TOOLS,
        '--strict-mcp-config',
        '--setting-sources', '',
        '--system-prompt', systemPrompt,
        '--model', model
    ];
}

export function isSessionNotFound(stderrText) {
    return /No conversation found with session ID/.test(stderrText);
}
