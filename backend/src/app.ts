import cors from 'cors';
import express, { type Express } from 'express';

import { healthRouter } from './routes/health-routes.js';
import { createRequirementRouter } from './routes/requirement-routes.js';
import { createLLMProvider } from './services/llm/provider-factory.js';
import type { LLMProvider } from './services/llm/llm-provider.js';
import { AppError } from './types/errors.js';

export interface AppDeps {
  /**
   * Override the LLM provider. Tests inject a fake implementing the same
   * interface; production resolves from environment variables.
   */
  getProvider?: () => LLMProvider;
}

export function createApp(deps: AppDeps = {}): Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  const getProvider = deps.getProvider ?? (() => createLLMProvider());

  app.use('/api', healthRouter);
  app.use('/api', createRequirementRouter({ getProvider }));

  app.use((_req, res) => {
    res
      .status(404)
      .json(new AppError('INVALID_REQUEST', 'Route not found.').toResponse());
  });

  return app;
}
