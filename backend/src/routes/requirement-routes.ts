import { Router } from 'express';

import {
  createExtractRequirementsHandler,
  type RequirementControllerDeps,
} from '../controllers/requirement-controller.js';

export function createRequirementRouter(
  deps: RequirementControllerDeps,
): Router {
  const router = Router();

  // POST /api/requirements/extract
  router.post('/requirements/extract', createExtractRequirementsHandler(deps));

  return router;
}
