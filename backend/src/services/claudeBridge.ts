/**
 * Client for claude-bridge (bridge/server.mjs), the host service that runs the
 * Claude Code CLI for "Discuss with Claude". Translates the CLI's stream-json
 * lines into the few events the app cares about.
 */

export type TurnErrorCode = 'session_not_found' | 'timeout' | 'cli_failed' | 'busy' | 'unreachable';

export type TurnEvent =
    | { type: 'status'; text: string }
    | { type: 'delta'; text: string }
    | { type: 'result'; text: string }
    | { type: 'error'; code: TurnErrorCode; message: string };

export interface TurnRequest {
    sessionId: string;
    resume: boolean;
    systemPrompt: string;
    message: string;
}

export interface BridgeClient {
    runTurn(req: TurnRequest, onEvent: (event: TurnEvent) => void): Promise<void>;
    health(): Promise<{ ok: boolean; claudeVersion?: string }>;
}

const BRIDGE_ERROR_CODES = new Set<TurnErrorCode>(['session_not_found', 'timeout', 'cli_failed']);

function hostname(url: unknown): string {
    try {
        return new URL(String(url)).hostname;
    } catch {
        return String(url);
    }
}

export function translateLine(line: unknown): TurnEvent | null {
    if (!line || typeof line !== 'object') return null;
    const event = line as Record<string, any>;

    switch (event['type']) {
        case 'stream_event': {
            const inner = event['event'];
            if (inner?.type === 'content_block_delta' && inner.delta?.type === 'text_delta') {
                return { type: 'delta', text: String(inner.delta.text ?? '') };
            }
            return null;
        }
        case 'assistant': {
            const toolUse = (event['message']?.content ?? []).find((block: any) => block?.type === 'tool_use');
            if (toolUse?.name === 'WebSearch') return { type: 'status', text: `Searching: ${toolUse.input?.query ?? ''}` };
            if (toolUse?.name === 'WebFetch') return { type: 'status', text: `Reading: ${hostname(toolUse.input?.url)}` };
            return null;
        }
        case 'result':
            return event['is_error']
                ? { type: 'error', code: 'cli_failed', message: String(event['result'] || event['subtype'] || 'Claude reported an error') }
                : { type: 'result', text: String(event['result'] ?? '') };
        case 'bridge_error': {
            const code = BRIDGE_ERROR_CODES.has(event['code']) ? event['code'] as TurnErrorCode : 'cli_failed';
            return { type: 'error', code, message: String(event['message'] ?? '') };
        }
        default:
            return null;
    }
}

export function createBridgeClient(
    baseUrl = process.env['CLAUDE_BRIDGE_URL'] ?? 'http://172.17.0.1:3010',
    token = process.env['CLAUDE_BRIDGE_TOKEN'] ?? ''
): BridgeClient {
    return {
        async runTurn(req, onEvent) {
            let response: Response;
            try {
                response = await fetch(`${baseUrl}/turn`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify(req)
                });
            } catch (error) {
                onEvent({ type: 'error', code: 'unreachable', message: 'Claude is not reachable right now' });
                return;
            }

            if (response.status === 409) {
                onEvent({ type: 'error', code: 'busy', message: 'Claude is busy with another reply; try again in a moment' });
                return;
            }
            if (!response.ok || !response.body) {
                onEvent({ type: 'error', code: 'cli_failed', message: `Bridge error ${response.status}` });
                return;
            }

            const decoder = new TextDecoder();
            const reader = response.body.getReader();
            let pending = '';
            let ended = false;
            const handle = (text: string) => {
                if (!text.trim()) return;
                let parsed: unknown;
                try {
                    parsed = JSON.parse(text);
                } catch {
                    return;
                }
                if ((parsed as { type?: string })?.type === 'bridge_done' || (parsed as { type?: string })?.type === 'bridge_error') {
                    ended = true;
                }
                const event = translateLine(parsed);
                if (event) onEvent(event);
            };

            try {
                for (;;) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    pending += decoder.decode(value, { stream: true });
                    let newline;
                    while ((newline = pending.indexOf('\n')) !== -1) {
                        handle(pending.slice(0, newline));
                        pending = pending.slice(newline + 1);
                    }
                }
                handle(pending);
            } catch {
                // Connection dropped mid-turn; reported below
            }

            if (!ended) {
                onEvent({ type: 'error', code: 'unreachable', message: 'Lost the connection to Claude mid-reply' });
            }
        },

        async health() {
            try {
                const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(3000) });
                if (!response.ok) return { ok: false };
                return await response.json() as { ok: boolean; claudeVersion?: string };
            } catch {
                return { ok: false };
            }
        }
    };
}
