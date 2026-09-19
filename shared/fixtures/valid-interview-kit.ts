import type { InterviewKit } from '../schemas/interview-kit.js';

/**
 * A fully valid, entirely fictional InterviewKit used by schema tests.
 * No real company data.
 */
export const validInterviewKit: InterviewKit = {
  source: {
    company: 'Northwind Labs',
    company_url: 'https://northwind-labs.example.com',
    jd_chars: 842,
    researched_at: '2026-01-15T09:30:00.000Z',
  },
  company: {
    summary:
      'Fictional company building internal analytics tooling for mid-size retailers.',
    products: ['Northwind Dashboard', 'Northwind Sync'],
    tech_signals: ['React', 'TypeScript', 'PostgreSQL'],
    notes: ['Fictional example data used for schema tests.'],
  },
  role: {
    title: 'Frontend Developer',
    seniority: 'mid',
    requirements: [
      {
        id: 'req-001',
        text: 'Experience building production web applications with React',
        kind: 'technical',
        priority: 'must',
      },
      {
        id: 'req-002',
        text: 'Strong TypeScript knowledge',
        kind: 'technical',
        priority: 'must',
      },
      {
        id: 'req-003',
        text: 'Good communication skills',
        kind: 'behavioural',
        priority: 'must',
      },
      {
        id: 'req-004',
        text: 'Familiarity with retail analytics workflows',
        kind: 'domain',
        priority: 'nice',
      },
    ],
  },
  questions: [
    {
      id: 'q-001',
      prompt: 'How do you decide when to split a React component?',
      category: 'technical',
      difficulty: 2,
      requirement_ids: ['req-001'],
      answer_outline:
        'Discuss reuse, prop drilling, render cost, and testability boundaries.',
    },
    {
      id: 'q-002',
      prompt: 'Describe a time you disagreed with a designer.',
      category: 'behavioural',
      difficulty: 1,
      requirement_ids: ['req-003'],
      answer_outline: 'Use a situation/action/result structure.',
    },
  ],
  flashcards: [
    {
      id: 'fc-001',
      front: 'What does TypeScript "strict" mode enable?',
      back: 'A group of stricter checks including strictNullChecks and noImplicitAny.',
      requirement_ids: ['req-002'],
    },
  ],
  schedule: {
    days_available: 2,
    days: [
      {
        day: 1,
        minutes: 60,
        question_ids: ['q-001'],
        focus: 'React fundamentals',
      },
      {
        day: 2,
        minutes: 45,
        question_ids: ['q-002'],
        focus: 'Behavioural stories',
      },
    ],
  },
  coverage: {
    passes: 1,
    uncovered_requirement_ids: ['req-004'],
    notes: ['req-004 is nice-to-have and was not covered in pass 1.'],
  },
};
