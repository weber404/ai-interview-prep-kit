import { Router } from 'express';

import {
  createGenerateQuestionsHandler,
  type QuestionControllerDeps,
} from '../controllers/question-controller.js';

export function createQuestionRouter(deps: QuestionControllerDeps): Router {
  const router = Router();

  // POST /api/questions/generate
  router.post('/questions/generate', createGenerateQuestionsHandler(deps));

  return router;
}
