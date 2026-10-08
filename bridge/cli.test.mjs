import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildArgs, isSessionNotFound } from './cli.mjs';

const ID = '11111111-2222-4333-8444-555555555555';
const PROMPT = 'You are discussing a book.';

function flagValue(args, flag) {
    const index = args.indexOf(flag);
    return index === -1 ? undefined : args[index + 1];
}

test('buildArgs for a new session', () => {
    const args = buildArgs({ sessionId: ID, resume: false, systemPrompt: PROMPT, model: 'opus' });
    assert.equal(args[0], '-p');
    assert.equal(flagValue(args, '--session-id'), ID);
    assert.ok(!args.includes('--resume'));
    assert.equal(flagValue(args, '--output-format'), 'stream-json');
    assert.ok(args.includes('--include-partial-messages'));
    assert.ok(args.includes('--verbose'));
    assert.equal(flagValue(args, '--tools'), 'WebSearch,WebFetch');
    assert.equal(flagValue(args, '--allowedTools'), 'WebSearch,WebFetch');
    assert.ok(args.includes('--strict-mcp-config'));
    assert.equal(flagValue(args, '--setting-sources'), '');
    assert.equal(flagValue(args, '--system-prompt'), PROMPT);
    assert.equal(flagValue(args, '--model'), 'opus');
});

test('buildArgs for a resume', () => {
    const args = buildArgs({ sessionId: ID, resume: true, systemPrompt: PROMPT, model: 'sonnet' });
    assert.equal(flagValue(args, '--resume'), ID);
    assert.ok(!args.includes('--session-id'));
    assert.equal(flagValue(args, '--system-prompt'), PROMPT);
});

test('buildArgs never puts the message in argv', () => {
    const message = 'My answer about Pierre';
    const args = buildArgs({ sessionId: ID, resume: false, systemPrompt: PROMPT, model: 'opus', message });
    assert.ok(!args.includes(message));
});

test('isSessionNotFound', () => {
    assert.equal(isSessionNotFound(`No conversation found with session ID: ${ID}`), true);
    assert.equal(isSessionNotFound('Error: rate limited'), false);
});
