import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

import { createApp, type AppDeps } from './app.js';
import { FakeLLMProvider } from './testing/fake-llm-provider.js';
import { ProviderError } from './types/errors.js';

const VALID_OUTPUT = JSON.stringify({
  requirements: [
    { text: 'Experience with React', kind: 'technical', priority: 'must' },
    { text: 'Good communication skills', kind: 'behavioural', priority: 'must' },
  ],
});

/** Boot the app on an ephemeral port and run `fn` against its base URL. */
async function withServer(
  deps: AppDeps,
  fn: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server: Server = createApp(deps).listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));

  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function postJd(baseUrl: string, body: unknown): Promise<Response> {
  return fetch(`${baseUrl}/api/requirements/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('GET /api/health returns {"status":"ok"}', async () => {
  await withServer({}, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  });
});

test('POST /api/requirements/extract returns requirements on success', async () => {
  const provider = new FakeLLMProvider([VALID_OUTPUT]);

  await withServer({ getProvider: () => provider }, async (baseUrl) => {
    const response = await postJd(baseUrl, {
      jd: 'Frontend Developer with React. Good communication skills required.',
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      requirements: [
        {
          id: 'req-001',
          text: 'Experience with React',
          kind: 'technical',
          priority: 'must',
        },
        {
          id: 'req-002',
          text: 'Good communication skills',
          kind: 'behavioural',
          priority: 'must',
        },
      ],
    });
  });
});

test('POST with an empty jd returns a structured 400', async () => {
  const provider = new FakeLLMProvider([VALID_OUTPUT]);

  await withServer({ getProvider: () => provider }, async (baseUrl) => {
    const response = await postJd(baseUrl, { jd: '   ' });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: {
        code: 'INVALID_JD',
        message: 'Job description cannot be empty.',
      },
    });
    assert.equal(provider.callCount, 0);
  });
});

test('POST with a missing jd field returns a structured 400', async () => {
  await withServer({ getProvider: () => new FakeLLMProvider([VALID_OUTPUT]) }, async (baseUrl) => {
    const response = await postJd(baseUrl, {});
    assert.equal(response.status, 400);

    const body = (await response.json()) as { error: { code: string } };
    assert.equal(body.error.code, 'INVALID_JD');
  });
});

test('provider failure returns 502 LLM_PROVIDER_ERROR without internals', async () => {
  const provider = new FakeLLMProvider([
    new ProviderError('HTTP 401 for key sk-live-secret', { retryable: false }),
  ]);

  await withServer({ getProvider: () => provider }, async (baseUrl) => {
    const response = await postJd(baseUrl, { jd: 'React developer.' });

    assert.equal(response.status, 502);
    const raw = await response.text();
    assert.ok(!raw.includes('sk-live-secret'));
    assert.deepEqual(JSON.parse(raw), {
      error: {
        code: 'LLM_PROVIDER_ERROR',
        message: 'Requirement extraction could not be completed.',
      },
    });
  });
});

test('persistently invalid model output returns 502 INVALID_LLM_OUTPUT', async () => {
  const provider = new FakeLLMProvider(['nonsense', 'more nonsense']);

  await withServer({ getProvider: () => provider }, async (baseUrl) => {
    const response = await postJd(baseUrl, { jd: 'React developer.' });

    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), {
      error: {
        code: 'INVALID_LLM_OUTPUT',
        message:
          'The language model returned an invalid requirement structure.',
      },
    });
  });
});

test('an invalid JD is reported as INVALID_JD even when credentials are missing', async () => {
  // Regression: input validation must run before provider resolution.
  const previous = process.env.LLM_API_KEY;
  delete process.env.LLM_API_KEY;

  try {
    await withServer({}, async (baseUrl) => {
      const response = await postJd(baseUrl, { jd: '   ' });

      assert.equal(response.status, 400);
      const body = (await response.json()) as { error: { code: string } };
      assert.equal(body.error.code, 'INVALID_JD');
    });
  } finally {
    if (previous !== undefined) process.env.LLM_API_KEY = previous;
  }
});

test('missing credentials surface as LLM_NOT_CONFIGURED, not fake data', async () => {
  // No getProvider override and no LLM_API_KEY in the environment.
  const previous = process.env.LLM_API_KEY;
  delete process.env.LLM_API_KEY;

  try {
    await withServer({}, async (baseUrl) => {
      const response = await postJd(baseUrl, { jd: 'React developer.' });

      assert.equal(response.status, 500);
      const body = (await response.json()) as { error: { code: string } };
      assert.equal(body.error.code, 'LLM_NOT_CONFIGURED');
    });
  } finally {
    if (previous !== undefined) process.env.LLM_API_KEY = previous;
  }
});
