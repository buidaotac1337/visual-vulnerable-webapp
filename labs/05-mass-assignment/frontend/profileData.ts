import type { LabExecutionResponse, LabPayload, TraceStepDraft } from '@/types';

/** Profile row returned by load_profile and update_profile. */
export interface Profile {
  username: string;
  email: string;
  role: string;
  balance: number;
}

/** Parsed update_profile result. */
export interface UpdateResult {
  updated: boolean;
  profile: Profile | null;
  error: string | null;
}

/** The only field the profile form itself shows. */
export const FORM_FIELD = 'email';

/** Fields that only trusted server code should ever change. */
const PRIVILEGED: readonly (keyof Profile)[] = ['role', 'balance'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Read a profile object from a response.
 *
 * @param value - Raw 'profile' value.
 * @returns Parsed profile, or null when absent.
 */
export function readProfile(value: unknown): Profile | null {
  if (!isRecord(value)) {
    return null;
  }
  return {
    username: String(value.username ?? ''),
    email: String(value.email ?? ''),
    role: String(value.role ?? ''),
    balance: Number(value.balance),
  };
}

/**
 * Read an update_profile response.
 *
 * @param data - Response data, or undefined.
 * @returns Parsed result, or null when the response is not an update result.
 */
export function readUpdate(data: Record<string, unknown> | undefined): UpdateResult | null {
  if (!data || typeof data.updated !== 'boolean') {
    return null;
  }
  return {
    updated: data.updated,
    profile: readProfile(data.profile),
    error: typeof data.error === 'string' ? data.error : null,
  };
}

/**
 * Request-body keys that the form does not show (added by hand, as with DevTools).
 *
 * @param payload - Sandbox payload, which is the request body.
 * @returns Extra keys in insertion order.
 */
export function extraKeys(payload: LabPayload): string[] {
  return Object.keys(payload).filter((key) => key !== FORM_FIELD);
}

/**
 * Format a profile value for display.
 *
 * @param key - Profile field.
 * @param profile - Profile to read.
 * @returns Display text.
 */
export function formatField(key: keyof Profile, profile: Profile): string {
  if (key !== 'balance') {
    return profile[key];
  }
  const amount = `$${Math.abs(profile.balance).toFixed(2)}`;
  return profile.balance < 0 ? `-${amount}` : amount;
}

/**
 * Privileged fields whose value differs between two profiles.
 * Shared by ProfileCard and buildRenderSteps so the UI and the trace never disagree.
 *
 * @param before - Profile shown when the form was sent.
 * @param after - Profile returned by the server.
 * @returns Lines such as 'role: customer → admin'.
 */
export function escalations(before: Profile | null, after: Profile | null): string[] {
  if (!before || !after) {
    return [];
  }
  return PRIVILEGED.filter((key) => before[key] !== after[key]).map(
    (key) => `${key}: ${formatField(key, before)} → ${formatField(key, after)}`,
  );
}

/**
 * Describe what the profile page shows after the response.
 *
 * @param response - update_profile response.
 * @param before - Profile shown when the form was sent.
 * @returns Frontend trace step appended after the backend trace.
 */
export function buildRenderSteps(
  response: LabExecutionResponse,
  before: Profile | null,
): TraceStepDraft[] {
  const result = readUpdate(response.data);
  if (!result) {
    // Not an update result (e.g. a runtime-error envelope): the backend trace says it all.
    return [];
  }
  if (!result.updated) {
    const detail = result.error ?? 'Hồ sơ không thay đổi.';
    return [
      {
        layer: 'frontend',
        tag: 'fe-render-profile',
        status: 'info',
        title: 'Hiển thị lỗi cập nhật hồ sơ',
        detail,
      },
    ];
  }
  const changed = escalations(before, result.profile);
  return [
    {
      layer: 'frontend',
      tag: 'fe-render-profile',
      status: changed.length > 0 ? 'danger' : 'info',
      title: changed.length > 0 ? 'Hồ sơ hiển thị quyền/số dư mới' : 'Hiển thị hồ sơ đã cập nhật',
      detail: changed.length > 0 ? changed.join('; ') : `Email: ${result.profile?.email ?? ''}`,
    },
  ];
}
