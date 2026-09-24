import type { APIRequestContext } from '@playwright/test';

const BASE = process.env.SURPRYZE_BASE_URL ?? 'http://127.0.0.1:3456';

export async function seedUser(
  request: APIRequestContext,
  email: string,
  password = 'ValidPass1!',
): Promise<void> {
  await request.post(`${BASE}/api/test/seed`, {
    data: { email, password, active: true },
  });
}

export async function requestReset(request: APIRequestContext, email: string) {
  return request.post(`${BASE}/api/reset-request`, { data: { email } });
}

export async function completeReset(request: APIRequestContext, token: string, password: string) {
  return request.post(`${BASE}/api/reset-complete`, { data: { token, password } });
}
