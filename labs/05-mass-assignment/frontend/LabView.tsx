import { useEffect, useRef, useState } from 'react';
import type { FormEvent, JSX } from 'react';
import { UserRound } from 'lucide-react';

import { LabCard, PrimaryButton, TextField } from '@/components';
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
    <LabCard
      title="MiniShop · Hồ sơ của tôi"
      icon={<UserRound className="h-4 w-4" aria-hidden="true" />}
      headerRight={<span className="text-xs text-subtlest">Đăng nhập: {actor ?? 'ẩn danh'}</span>}
    >
      <ProfileCard profile={profile} />

      <form
        key={`f-${String(inputFlashSeq)}`}
        onSubmit={handleSubmit}
        className={`flex flex-col gap-2 rounded-large ${flashClass}`}
      >
        <TextField
          id="ma-email"
          label="Email"
          value={readEmail(payload)}
          disabled={isExecuting}
          onChange={(value) => onPayloadChange({ ...payload, [FORM_FIELD]: value })}
        />
        <ExtraFields payload={payload} disabled={isExecuting} onChange={onPayloadChange} />
        <PrimaryButton
          type="submit"
          isBusy={isExecuting}
          busyLabel="Đang lưu..."
          className="self-end"
        >
          {extras.length > 0 ? 'Lưu (kèm trường ẩn)' : 'Lưu hồ sơ'}
        </PrimaryButton>
      </form>

      <UpdateNotice result={result} before={before} />
    </LabCard>
  );
}
