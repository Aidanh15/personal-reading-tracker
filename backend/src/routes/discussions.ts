import { Router, Request, Response, NextFunction } from 'express';
import { DiscussionQueries } from '../database/queries/discussions';
import { validateBody, validateParams } from '../middleware/validation';
import { createError } from '../middleware/errorHandler';
import { createBridgeClient } from '../services/claudeBridge';
import { createDiscussionService, DiscussionError, Emit } from '../services/discussions';
import { draftBodySchema, idParamSchema, messageBodySchema, reviewBodySchema } from './discussionSchemas';

const bridge = createBridgeClient();
const service = createDiscussionService(bridge, process.env['CLAUDE_BRIDGE_MODEL'] ?? null);

const id = (req: Request) => req.params['id'] as unknown as number;

/**
 * Runs a streaming turn as server-sent events. The stream opens on the first
 * event, so errors raised before the turn starts (404, 409, nothing to retry)
 * still go out as ordinary JSON errors.
 */
async function stream(res: Response, next: NextFunction, run: (emit: Emit) => Promise<unknown>) {
  let open = false;
  const emit: Emit = event => {
    if (!open) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
        Connection: 'keep-alive'
      });
      res.flushHeaders();
      open = true;
    }
    if (!res.writableEnded) res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  };

  try {
    await run(emit);
    if (open) res.end();
  } catch (error) {
    if (!open) {
      next(error instanceof DiscussionError ? createError(error.message, error.status, 'DISCUSSION_ERROR') : error);
      return;
    }
    console.error('Discussion turn failed:', error);
    emit({ type: 'error', code: 'cli_failed', message: 'Something went wrong saving the reply' });
    res.end();
  }
}

function plain(handler: (req: Request, res: Response) => void) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      handler(req, res);
    } catch (error) {
      next(error instanceof DiscussionError ? createError(error.message, error.status, 'DISCUSSION_ERROR') : error);
    }
  };
}

// Mounted at /api/books
export const bookDiscussionsRouter = Router();

bookDiscussionsRouter.get('/:id/discussions', validateParams(idParamSchema), plain((req, res) => {
  res.json({ discussions: DiscussionQueries.listForBook(id(req)) });
}));

bookDiscussionsRouter.post('/:id/discussions', validateParams(idParamSchema), (req, res, next) =>
  stream(res, next, emit => service.start(id(req), emit)));

// Mounted at /api/discussions
export const discussionsRouter = Router();

discussionsRouter.get('/:id', validateParams(idParamSchema), plain((req, res) => {
  const discussion = DiscussionQueries.get(id(req));
  if (!discussion) throw new DiscussionError(404, 'Discussion not found');
  res.json({ discussion, messages: DiscussionQueries.messages(discussion.id) });
}));

discussionsRouter.post('/:id/messages', validateParams(idParamSchema), validateBody(messageBodySchema), (req, res, next) =>
  stream(res, next, emit => service.reply(id(req), req.body.content, emit)));

discussionsRouter.post('/:id/review', validateParams(idParamSchema), validateBody(reviewBodySchema), (req, res, next) =>
  stream(res, next, emit => service.writeReview(id(req), req.body.instructions, emit)));

discussionsRouter.put('/:id/review', validateParams(idParamSchema), validateBody(draftBodySchema), plain((req, res) => {
  res.json({ discussion: service.saveDraft(id(req), req.body.draft, req.body.rating) });
}));

discussionsRouter.post('/:id/apply', validateParams(idParamSchema), plain((req, res) => {
  res.json({ discussion: service.apply(id(req)) });
}));

discussionsRouter.delete('/:id', validateParams(idParamSchema), plain((req, res) => {
  if (service.isRunning(id(req))) throw new DiscussionError(409, 'A reply is in progress');
  if (!DiscussionQueries.delete(id(req))) throw new DiscussionError(404, 'Discussion not found');
  res.status(204).end();
}));

// Mounted at /api/claude
export const claudeRouter = Router();

claudeRouter.get('/health', async (_req, res) => {
  res.json(await bridge.health());
});
