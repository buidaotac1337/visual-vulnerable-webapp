import type { JSX } from 'react';
import { CircleX } from 'lucide-react';

import { ResultNotice } from '@/components';

import { escalations, formatField } from './profileData';
import type { Profile, UpdateResult } from './profileData';

interface ProfileCardProps {
  profile: Profile | null;
}

interface UpdateNoticeProps {
  result: UpdateResult | null;
  before: Profile | null;
}

/**
 * Current profile of the logged-in persona, as the API returns it.
 *
 * @param props - Profile from load_profile, or null when anonymous.
 * @returns Profile summary listing every field the API exposes.
 */
export function ProfileCard({ profile }: ProfileCardProps): JSX.Element {
  if (!profile) {
    return <p className="text-xs text-subtlest">Đăng nhập để xem hồ sơ.</p>;
  }
  const admin = profile.role === 'admin';
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-large border border-default bg-surface-sunken p-3 text-xs">
      <dt className="text-subtlest">Tài khoản</dt>
      <dd className="font-semibold text-default">{profile.username}</dd>
      <dt className="text-subtlest">Email</dt>
      <dd className="text-default">{profile.email}</dd>
      <dt className="text-subtlest">Vai trò</dt>
      <dd>
        <span
          className={`rounded-small px-1.5 py-0.5 font-semibold ${admin ? 'bg-danger-subtler text-danger' : 'bg-neutral-hovered text-subtle'}`}
        >
          {profile.role}
        </span>
      </dd>
      <dt className="text-subtlest">Số dư</dt>
      <dd className="text-default">{formatField('balance', profile)}</dd>
    </dl>
  );
}

/**
 * Outcome of the last profile update.
 *
 * @param props - Parsed update result and the profile shown when the form was sent.
 * @returns Success or error notice, a privilege warning, or nothing before the first save.
 */
export function UpdateNotice({ result, before }: UpdateNoticeProps): JSX.Element | null {
  if (!result) {
    return null;
  }
  if (!result.updated) {
    return (
      <ResultNotice
        tone="neutral"
        icon={<CircleX className="h-4 w-4 shrink-0 text-subtlest" aria-hidden="true" />}
      >
        {result.error ?? 'Hồ sơ không thay đổi.'}
      </ResultNotice>
    );
  }
  const changed = escalations(before, result.profile);
  if (changed.length === 0) {
    return <ResultNotice tone="safe">Đã lưu hồ sơ.</ResultNotice>;
  }
  return (
    <ResultNotice tone="danger">
      Server đã ghi cả trường ngoài form: {changed.join('; ')}.
    </ResultNotice>
  );
}
