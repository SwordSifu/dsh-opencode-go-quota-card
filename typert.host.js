// Generated-by-hand Typert host manifest for the opencodeQuota Remote.
// The typert-loader imports this via package.json exports["./typert"] and
// registers it into ctx.typert.local, which the Host gateway uses to claim
// and dispatch the "opencodeQuota/usage" endpoint in strict mode.

import { z } from 'zod';

const windowSchema = z.object({
  status: z.string().nullable(),
  percent: z.number().nullable(),
  resetsAt: z.string().nullable(),
});

const resultSchema = z.object({
  state: z.enum(['ok', 'error', 'loading']),
  fetchedAt: z.number().nullable(),
  error: z.string().nullable(),
  detail: z.string().nullable(),
  usage: z.object({
    rolling: windowSchema.nullable(),
    weekly: windowSchema.nullable(),
    monthly: windowSchema.nullable(),
  }).nullable(),
});

const invocation = {
  service: 'opencodeQuota',
  namespace: 'opencodeQuota',
  invocation: { kind: 'direct' },
  parameters: [],
  result: {
    mode: 'strict',
    typeSymbol: 'dsh-opencode-go-quota-card#OpencodeQuotaResult',
    schema: resultSchema,
  },
};

export const TYPERT = {
  package: 'dsh-opencode-go-quota-card',
  face: 'host',
  schemas: [],
  invocations: [
    { ...invocation, id: 'dsh-opencode-go-quota-card#opencodeQuota/usage', method: 'usage' },
    { ...invocation, id: 'dsh-opencode-go-quota-card#opencodeQuota/refresh', method: 'refresh' },
  ],
  model: { services: [], events: [], objects: [] },
};
