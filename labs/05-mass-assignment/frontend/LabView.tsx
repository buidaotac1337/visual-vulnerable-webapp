import { useEffect, useRef, useState } from 'react';
import type { FormEvent, JSX } from 'react';
import { UserRound } from 'lucide-react';

import type { LabExecutionResponse, LabPayload, LabViewProps } from '@/types';

import { ExtraFields } from './ExtraFields';
import { ProfileCard, UpdateNotice } from './ProfileCard';
import { FORM_FIELD, buildRenderSteps, extraKeys, readProfile, readUpdate } from './profileData';
import type { Profile } from './profileData';

const LAB_ID = '05-mass-assignment';

/** Reload 'Hồ sơ của tôi' silently on persona, mode, reset, or after an applied update. */
function useProfile(props: LabViewProps): Profile | null {
  const { actor, mode, dbResetSeq, lastResponse, onExecute } = props;
  const [profile, setProfile] = useState<Profile | null>(null);
  const executeRef = useRef(onExecute);
  executeRef.current = onExecute;
  // Only an applied update changes the stored profile. Remember the last one, so a later
  // rejected update (or a cleared response) does not count as a change and reload again.
  const appliedRef = useRef<LabExecutionResponse | null>(null);
  if (readUpdate(lastResponse?.data)?.updated === true) {
    appliedRef.current = lastResponse;
  }
  const applied = appliedRef.current;

  useEffect(() => {
    let active = true;
    void executeRef.current('load_profile', {}, { silent: true }).then((response) => {
      // Keep the last good profile if a silent reload fails.
      if (active && response?.ok) {
        setProfile(readProfile(response.data.profile));
      }
    });
    return () => {
      active = false;
    };
  }, [actor, mode, dbResetSeq, applied]);

  return profile;
}

/** Email typed in the form (the sandbox payload is the whole request body). */
function readEmail(payload: LabPayload): string {
  const value = payload[FORM_FIELD];
  return typeof value === 'string' ? value : '';
}

/**
 * Interactive MiniShop 'my profile' page for Lab 05 (mass assignment).
 *
 * @param props - Standardized VVWA LabViewProps injected by SandboxPane.
 * @returns Rendered profile, profile form, extra request fields, and update result.
 */
export function LabView(props: LabViewProps): JSX.Element {
  const { mode, actor, payload, onPayloadChange, inputFlashSeq, isExecuting, lastResponse } = props;
  const profile = useProfile(props);
  const [before, setBefore] = useState<Profile | null>(null);
  const result = readUpdate(lastResponse?.data);
  const extras = extraKeys(payload);
  const flashClass = inputFlashSeq > 0 ? 'vvwa-input-flash' : '';

  // @snippet:start
  const saveProfile = (body: LabPayload): void => {
    setBefore(profile);
    const hidden = extraKeys(body);
    // @step:fe-submit-profile
    void props.onExecute('update_profile', body, {
      frontendStepsBefore: [
        {
          layer: 'frontend',
          tag: 'fe-submit-profile',
          status: hidden.length > 0 ? 'warning' : 'info',
          title:
            hidden.length > 0
              ? `Gửi form hồ sơ kèm trường ngoài form: ${hidden.join(', ')}`
              : 'Gửi form hồ sơ',
          detail: `POST /api/labs/${LAB_ID}/${mode}/update_profile ${JSON.stringify(body)}`,
        },
      ],
      // @step:fe-render-profile
      frontendStepsAfter: (response) => buildRenderSteps(response, profile),
    });
  };
  // @snippet:end

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    saveProfile(payload);
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <UserRound className="h-4 w-4 text-brand-600" aria-hidden="true" />
          <span>MiniShop · Hồ sơ của tôi</span>
        </div>
        <span className="text-xs text-slate-500">Đăng nhập: {actor ?? 'ẩn danh'}</span>
      </div>

      <ProfileCard profile={profile} />

      <form
        key={`f-${String(inputFlashSeq)}`}
        onSubmit={handleSubmit}
        className={`flex flex-col gap-2 rounded-lg ${flashClass}`}
      >
        <label htmlFor="ma-email" className="text-xs font-medium text-slate-700">
          Email
        </label>
        <input
          id="ma-email"
          type="text"
          value={readEmail(payload)}
          disabled={isExecuting}
          onChange={(event) => onPayloadChange({ ...payload, [FORM_FIELD]: event.target.value })}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
        <ExtraFields payload={payload} disabled={isExecuting} onChange={onPayloadChange} />
        <button
          type="submit"
          disabled={isExecuting}
          className="cursor-pointer self-end rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isExecuting ? 'Đang lưu...' : extras.length > 0 ? 'Lưu (kèm trường ẩn)' : 'Lưu hồ sơ'}
        </button>
      </form>

      <UpdateNotice result={result} before={before} />
    </div>
  );
}
