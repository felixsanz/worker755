import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyModels } from '../src/models.ts';
import { VERTEX_EXPRESS_BASE_URL, vertexBaseUrl } from '../src/providers.ts';

/** Runs fn with temporary VERTEX_PROJECT / VERTEX_LOCATION values and restores them afterward. */
async function withVertexEnv(env: { project?: string; location?: string }, fn: () => void | Promise<void>) {
  const prevProject = process.env.VERTEX_PROJECT;
  const prevLocation = process.env.VERTEX_LOCATION;
  if (env.project === undefined) delete process.env.VERTEX_PROJECT;
  else process.env.VERTEX_PROJECT = env.project;
  if (env.location === undefined) delete process.env.VERTEX_LOCATION;
  else process.env.VERTEX_LOCATION = env.location;
  try {
    await fn();
  } finally {
    if (prevProject === undefined) delete process.env.VERTEX_PROJECT;
    else process.env.VERTEX_PROJECT = prevProject;
    if (prevLocation === undefined) delete process.env.VERTEX_LOCATION;
    else process.env.VERTEX_LOCATION = prevLocation;
  }
}

/** Runs fn with globalThis.fetch replaced and restores the original fetch afterward. */
async function withFetch(stub: typeof fetch, fn: () => Promise<void>) {
  const prev = globalThis.fetch;
  globalThis.fetch = stub;
  try {
    await fn();
  } finally {
    globalThis.fetch = prev;
  }
}

test('vertexBaseUrl resolves Express default, project overrides, and rejects unsafe values', async () => {
  await withVertexEnv({}, () => {
    assert.equal(vertexBaseUrl(), VERTEX_EXPRESS_BASE_URL);
  });
  await withVertexEnv({ project: 'my-proj' }, () => {
    assert.equal(vertexBaseUrl(), 'https://aiplatform.googleapis.com/v1/projects/my-proj/locations/global/publishers/google');
  });
  await withVertexEnv({ project: 'my-proj', location: 'us-central1' }, () => {
    assert.equal(
      vertexBaseUrl(),
      'https://us-central1-aiplatform.googleapis.com/v1/projects/my-proj/locations/us-central1/publishers/google',
    );
  });
  await withVertexEnv({ project: 'my-proj', location: 'eu' }, () => {
    assert.equal(
      vertexBaseUrl(),
      'https://aiplatform.eu.rep.googleapis.com/v1/projects/my-proj/locations/eu/publishers/google',
    );
  });
  await withVertexEnv({ project: 'my-proj', location: 'us' }, () => {
    assert.equal(
      vertexBaseUrl(),
      'https://aiplatform.us.rep.googleapis.com/v1/projects/my-proj/locations/us/publishers/google',
    );
  });
  for (const bad of ['-', '../evil', 'proj/sub', 'bad proj']) {
    await withVertexEnv({ project: bad }, () => {
      assert.equal(vertexBaseUrl(), VERTEX_EXPRESS_BASE_URL);
    });
  }
  await withVertexEnv({ project: 'my-proj', location: 'bad/loc' }, () => {
    assert.equal(vertexBaseUrl(), VERTEX_EXPRESS_BASE_URL);
  });
});

test('keyModels for Google filters AI Studio list to Gemini chat models and maps auth/credit errors', async () => {
  const urls: string[] = [];
  const keys: string[] = [];
  await withFetch(
    (async (input, init) => {
      urls.push(String(input));
      keys.push(new Headers(init?.headers).get('x-goog-api-key') ?? '');
      return new Response(
        JSON.stringify({
          models: [
            { name: 'models/gemini-3.1-flash-lite', displayName: 'Gemini 3.1 Flash Lite', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/gemini-4-hydrogen', displayName: 'Gemini 4 Hydrogen', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/gemini-3.1-flash-image', displayName: 'Nano Banana 2', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/gemini-nano-banana-2.1', displayName: 'Nano Banana 2.1', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/gemini-3.8-flash-tts', displayName: 'Gemini 3.8 Flash TTS', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/gemini-3.5-transcribe', displayName: 'Gemini 3.5 Transcribe', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/gemini-robotics-er-2-preview', displayName: 'Robotics', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/gemini-embedding-2', displayName: 'Embedding 2', supportedGenerationMethods: ['embedContent'] },
            { name: 'models/gemma-4-31b-it', displayName: 'Gemma 4 31B', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/lyria-3.5', displayName: 'Lyria 3.5', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/gemini-3.8-live', displayName: 'Gemini 3.8 Live', supportedGenerationMethods: ['bidiGenerateContent'] },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }) as typeof fetch,
    async () => {
      const res = await keyModels({ provider: 'google', apiKey: 'google-test-key-0123456789abcdef' });
      assert.ok('models' in res);
      assert.deepEqual(res.models, [
        { id: 'google/gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
        { id: 'google/gemini-4-hydrogen', label: 'Gemini 4 Hydrogen' },
      ]);
      assert.equal(urls[0], 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000');
      assert.equal(keys[0], 'google-test-key-0123456789abcdef');
    },
  );

  for (const [status, problem] of [
    [401, 'key'],
    [403, 'key'],
    [402, 'credit'],
    [500, 'down'],
  ] as const) {
    await withFetch((async () => new Response('{}', { status })) as typeof fetch, async () => {
      assert.deepEqual(await keyModels({ provider: 'google', apiKey: 'test-key-0123456789abcdef' }), { problem });
    });
  }

  await withFetch(
    (async () =>
      new Response(
        JSON.stringify({
          error: { code: 400, details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID' }] },
        }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      )) as typeof fetch,
    async () => {
      assert.deepEqual(await keyModels({ provider: 'google', apiKey: 'test-key-0123456789abcdef' }), { problem: 'key' });
    },
  );

  for (const body of ['{}', JSON.stringify({ error: { details: [{ reason: 'OTHER' }] } })]) {
    await withFetch((async () => new Response(body, { status: 400 })) as typeof fetch, async () => {
      assert.deepEqual(await keyModels({ provider: 'google', apiKey: 'test-key-0123456789abcdef' }), { problem: 'down' });
    });
  }
});

test('keyModels for Vertex AI probes countTokens against vertexBaseUrl and maps errors', async () => {
  await withVertexEnv({}, async () => {
    const seenUrls: string[] = [];
    await withFetch(
      (async (input) => {
        const url = String(input);
        seenUrls.push(url);
        const ok = url.includes('gemini-3.1-flash-lite:') || url.includes('gemini-4-argon:');
        return new Response('{}', { status: ok ? 200 : 404 });
      }) as typeof fetch,
      async () => {
        const res = await keyModels({ provider: 'vertex', apiKey: 'vertex-test-key-0123456789abcdef' });
        assert.ok('models' in res);
        assert.deepEqual(res.models, [
          { id: 'google/gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
          { id: 'google/gemini-4-argon', label: 'Gemini 4 Argon' },
        ]);
        assert.ok(seenUrls.every((u) => u.startsWith(`${VERTEX_EXPRESS_BASE_URL}/models/`) && u.endsWith(':countTokens')));
      },
    );
  });

  await withVertexEnv({ project: 'demo-proj', location: 'global' }, async () => {
    const seenUrls: string[] = [];
    await withFetch(
      (async (input) => {
        seenUrls.push(String(input));
        return new Response('{}', { status: 200 });
      }) as typeof fetch,
      async () => {
        const res = await keyModels({ provider: 'vertex', apiKey: 'vertex-test-key-0123456789abcdef' });
        assert.ok('models' in res);
        assert.ok(res.models.some((m) => m.id === 'google/gemini-4-hydrogen'));
        assert.ok(
          seenUrls.every((u) =>
            u.startsWith('https://aiplatform.googleapis.com/v1/projects/demo-proj/locations/global/publishers/google/models/'),
          ),
        );
      },
    );
  });

  await withVertexEnv({}, async () => {
    for (const denied of [403, 402]) {
      await withFetch(
        (async (input) => {
          const url = String(input);
          if (url.includes('gemini-4-argon:')) return new Response('{}', { status: 200 });
          if (url.includes('gemini-3.1-pro-preview:')) return new Response('{}', { status: denied });
          return new Response('{}', { status: 404 });
        }) as typeof fetch,
        async () => {
          assert.deepEqual(await keyModels({ provider: 'vertex', apiKey: 'vertex-test-key-0123456789abcdef' }), {
            models: [{ id: 'google/gemini-4-argon', label: 'Gemini 4 Argon' }],
          });
        },
      );
    }

    for (const [status, problem] of [
      [401, 'key'],
      [403, 'key'],
      [402, 'credit'],
      [500, 'down'],
    ] as const) {
      await withFetch((async () => new Response('{}', { status })) as typeof fetch, async () => {
        assert.deepEqual(await keyModels({ provider: 'vertex', apiKey: 'vertex-test-key-0123456789abcdef' }), { problem });
      });
    }
  });
});
