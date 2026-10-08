import { AxiosResponse } from 'axios';
import api, { apiBaseURL } from './api';
import { Discussion, DiscussionMessage } from '../types';

export type StreamEvent =
  | { type: 'discussion'; discussion: Discussion }
  | { type: 'status'; text: string }
  | { type: 'delta'; text: string }
  | { type: 'done'; message: DiscussionMessage; discussion: Discussion }
  | { type: 'error'; code?: string; message: string };

type OnEvent = (event: StreamEvent) => void;

/**
 * POSTs to a streaming endpoint and feeds its server-sent events to onEvent.
 * Errors (HTTP or network) arrive as an 'error' event; this never throws,
 * except when the caller aborts.
 */
async function streamPost(path: string, body: unknown, onEvent: OnEvent, signal?: AbortSignal): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseURL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body ?? {}),
      ...(signal && { signal })
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    onEvent({ type: 'error', code: 'unreachable', message: 'Network error - please check your connection' });
    return;
  }

  if (!response.ok || !response.body) {
    let message = response.statusText || `Request failed with status ${response.status}`;
    try {
      const data = await response.json();
      message = data?.error?.message ?? message;
    } catch {
      // not JSON
    }
    onEvent({ type: 'error', code: String(response.status), message });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finished = false;

  const handleFrame = (frame: string) => {
    const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
    if (!data) return;
    try {
      const event = JSON.parse(data) as StreamEvent;
      if (event.type === 'done' || event.type === 'error') finished = true;
      onEvent(event);
    } catch {
      // ignore malformed frames
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        handleFrame(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
      }
    }
    if (buffer.trim()) handleFrame(buffer);
  } catch (error) {
    if (signal?.aborted) throw error;
  }

  if (!finished) {
    onEvent({ type: 'error', code: 'interrupted', message: 'The connection dropped. If Claude was mid-reply, it will still be saved; reload to see it.' });
  }
}

export const discussionsApi = {
  async health(): Promise<{ ok: boolean }> {
    try {
      const response: AxiosResponse<{ ok: boolean }> = await api.get('/claude/health');
      return response.data;
    } catch {
      return { ok: false };
    }
  },

  async list(bookId: number): Promise<Discussion[]> {
    const response: AxiosResponse<{ discussions: Discussion[] }> = await api.get(`/books/${bookId}/discussions`);
    return response.data.discussions;
  },

  async get(id: number): Promise<{ discussion: Discussion; messages: DiscussionMessage[] }> {
    const response: AxiosResponse<{ discussion: Discussion; messages: DiscussionMessage[] }> = await api.get(`/discussions/${id}`);
    return response.data;
  },

  async saveDraft(id: number, draft: string, rating: number | null): Promise<Discussion> {
    const response: AxiosResponse<{ discussion: Discussion }> = await api.put(`/discussions/${id}/review`, { draft, rating });
    return response.data.discussion;
  },

  /** Rejects with status 409 when the book has a different review, unless confirm is true. */
  async apply(id: number, confirm = false): Promise<Discussion> {
    const response: AxiosResponse<{ discussion: Discussion }> = await api.post(`/discussions/${id}/apply`, { confirm });
    return response.data.discussion;
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/discussions/${id}`);
  },

  start(bookId: number, onEvent: OnEvent, signal?: AbortSignal): Promise<void> {
    return streamPost(`/books/${bookId}/discussions`, {}, onEvent, signal);
  },

  reply(id: number, content: string | null, onEvent: OnEvent, signal?: AbortSignal): Promise<void> {
    return streamPost(`/discussions/${id}/messages`, { content }, onEvent, signal);
  },

  writeReview(id: number, instructions: string | undefined, onEvent: OnEvent, signal?: AbortSignal): Promise<void> {
    return streamPost(`/discussions/${id}/review`, instructions ? { instructions } : {}, onEvent, signal);
  }
};
