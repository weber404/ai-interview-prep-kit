import type { Request, Response } from 'express';

import { GenerateQuestionsRequestSchema } from '../schemas/question-request.js';
import {
  generateQuestions,
  validateRequirements,
} from '../services/question-generator.js';
import type { LLMProvider } from '../services/llm/llm-provider.js';
import { AppError } from '../types/errors.js';
import { logger } from '../utils/logger.js';

export interface QuestionControllerDeps {
  /**
   * Resolved lazily so the server can start without credentials and only
   * fail when question generation is actually requested.
   */
  getProvider: () => LLMProvider;
}

export function createGenerateQuestionsHandler(deps: QuestionControllerDeps) {
  return async function generateQuestionsHandler(
    req: Request,
    res: Response,
  ): Promise<void> {
    const parsedBody = GenerateQuestionsRequestSchema.safeParse(req.body);

    if (!parsedBody.success) {
      const firstIssue = parsedBody.error.issues[0];
      const message = firstIssue?.message ?? 'Request body is invalid.';
      const code =
        firstIssue?.path[0] === 'requirements' &&
        firstIssue.code !== 'invalid_type'
          ? 'INVALID_REQUIREMENTS'
          : 'INVALID_REQUEST';

      res.status(400).json(new AppError(code, message).toResponse());
      return;
    }

    try {
      // Validate requirements array before provider resolution so bad requests
      // are rejected even if credentials are not configured.
      const requirements = validateRequirements(parsedBody.data.requirements);

      const provider = deps.getProvider();
      const questions = await generateQuestions(requirements, { provider });
      res.status(200).json({ questions });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.status).json(error.toResponse());
        return;
      }

      logger.error('Unexpected error during question generation', {
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
