# shared

The canonical InterviewKit contract. Both `backend/` and `frontend/` import
from here — there must be exactly one definition of each type and schema.

```
shared/
├── types/
│   └── interview-kit.ts      hand-written TypeScript contract
├── schemas/
│   ├── interview-kit.ts      Zod schemas (runtime enforcement)
│   └── interview-kit.test.ts
├── fixtures/
│   └── valid-interview-kit.ts  fictional fixture used by tests
└── index.ts                  package entry point
```

Consumers import by package name:

```ts
import { RequirementSchema, type Requirement } from '@interview-prep-ai/shared';
```

The package compiles to `dist/`, so run `npm run build:shared` from the repo
root before typechecking or running the backend.

Cross-entity referential rules (requirement_ids resolving, must-coverage,
schedule length) are intentionally deferred to later pipeline steps and are
documented as TODOs in `schemas/interview-kit.ts`.
