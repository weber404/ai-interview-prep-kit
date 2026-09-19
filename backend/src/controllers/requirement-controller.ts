import type { Request, Response } from 'express';

import { ExtractRequirementsRequestSchema } from '../schemas/requirement-request.js';
import {
  extractRequirements,
  validateJobDescription,
} from '../services/requirement-extractor.js';
import type { LLMProvider } from '../services/llm/llm-provider.js';
import { AppError } from '../types/errors.js';
import { logger } from '../utils/logger.js';

export interface RequirementControllerDeps {
  /**
   * Resolved lazily so the server can start without credentials and only
   * fail when an extraction is actually requested.
   */
  getProvider: () => LLMProvider;
}

export function createExtractRequirementsHandler(
  deps: RequirementControllerDeps,
) {
  return async function extractRequirementsHandler(
    req: Request,
    res: Response,
  ): Promise<void> {
    const parsedBody = ExtractRequirementsRequestSchema.safeParse(req.body);

    if (!parsedBody.success) {
      const message =
        parsedBody.error.issues[0]?.message ??
        'Request body is invalid.';
      res.status(400).json(new AppError('INVALID_JD', message).toResponse());
      return;
    }

    try {
      // Validate the JD before resolving the provider, so bad input is
      // reported as INVALID_JD even when credentials are missing.
      const jd = validateJobDescription(parsedBody.data.jd);

      const provider = deps.getProvider();
      const requirements = await extractRequirements(jd, { provider });
      res.status(200).json({ requirements });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.status).json(error.toResponse());
        return;
      }

      // Unexpected failure: log server-side, return nothing revealing.
      logger.error('Unexpected error during requirement extraction', {
        reason: error instanceof Error ? error.message : 'unknown',
      });
      res
        .status(500)
        .json(
          new AppError(
            'INTERNAL_ERROR',
            'An unexpected error occurred.',
          ).toResponse(),
        );
    }
  };
}
