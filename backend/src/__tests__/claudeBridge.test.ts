import { translateLine } from '../services/claudeBridge';

describe('translateLine', () => {
    it('turns text deltas into delta events', () => {
        expect(translateLine({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hel' } } }))
            .toEqual({ type: 'delta', text: 'Hel' });
    });

    it('turns web searches and fetches into status events', () => {
        const toolUse = (name: string, input: object) => ({ type: 'assistant', message: { content: [{ type: 'tool_use', name, input }] } });
        expect(translateLine(toolUse('WebSearch', { query: 'Tolstoy steam engine' })))
            .toEqual({ type: 'status', text: 'Searching: Tolstoy steam engine' });
        expect(translateLine(toolUse('WebFetch', { url: 'https://en.wikipedia.org/wiki/War_and_Peace' })))
            .toEqual({ type: 'status', text: 'Reading: en.wikipedia.org' });
    });

    it('turns a successful result into a result event and a failed one into an error', () => {
        expect(translateLine({ type: 'result', subtype: 'success', is_error: false, result: 'Final text' }))
            .toEqual({ type: 'result', text: 'Final text' });
        expect(translateLine({ type: 'result', subtype: 'error_during_execution', is_error: true, result: '' }))
            .toMatchObject({ type: 'error', code: 'cli_failed' });
    });

    it('passes bridge errors through with their code', () => {
        expect(translateLine({ type: 'bridge_error', code: 'session_not_found', message: 'No conversation found' }))
            .toEqual({ type: 'error', code: 'session_not_found', message: 'No conversation found' });
    });

    it('ignores everything else', () => {
        expect(translateLine({ type: 'system', subtype: 'init' })).toBeNull();
        expect(translateLine({ type: 'bridge_done' })).toBeNull();
        expect(translateLine({ type: 'assistant', message: { content: [{ type: 'text', text: 'full text' }] } })).toBeNull();
        expect(translateLine('not an object')).toBeNull();
    });
});
