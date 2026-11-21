import { useState } from 'react';
import type { JSX, KeyboardEvent } from 'react';
import { Plus, X } from 'lucide-react';

import type { LabPayload } from '@/types';

import { FORM_FIELD, extraKeys } from './profileData';

interface ExtraFieldsProps {
  payload: LabPayload;
  disabled: boolean;
  onChange: (next: LabPayload) => void;
}

const INPUT_CLASS =
  'rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200';

function asText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : ((JSON.stringify(value) as string | undefined) ?? '');
}

function withoutKey(payload: LabPayload, key: string): LabPayload {
  return Object.fromEntries(Object.entries(payload).filter(([name]) => name !== key));
}

/**
 * Request-body fields that the profile form does not show.
 *
 * The browser sends whatever JSON it is given: these rows play the role of
 * DevTools or an intercepting proxy adding keys next to the form's email field.
 *
 * @param props - Request body (sandbox payload) and change handler.
 * @returns Editable list of extra fields plus a row to add one.
 */
export function ExtraFields({ payload, disabled, onChange }: ExtraFieldsProps): JSX.Element {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const keys = extraKeys(payload);
  const key = newKey.trim();
  const canAdd = !disabled && key !== '' && key !== FORM_FIELD;

  const add = (): void => {
    onChange({ ...payload, [key]: newValue });
    setNewKey('');
    setNewValue('');
  };
  // These inputs sit inside the profile form: Enter adds the field instead of submitting.
  const addOnEnter = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (canAdd) {
        add();
      }
    }
  };

  return (
    <fieldset className="flex flex-col gap-1.5 rounded-lg border border-dashed border-amber-300 bg-amber-50/40 p-2.5">
      <legend className="px-1 text-[11px] font-semibold text-amber-700">
        Trường thêm vào request (ngoài form)
      </legend>
      {keys.length === 0 && (
        <p className="text-[11px] text-slate-500">Form chỉ gửi email. Chưa có trường nào khác.</p>
      )}
      {keys.map((name) => (
        <div key={name} className="flex items-center gap-1.5">
          <code className="w-20 shrink-0 truncate text-xs text-amber-800">{name}</code>
          <input
            aria-label={`Giá trị trường ${name}`}
            value={asText(payload[name])}
            disabled={disabled}
            onChange={(event) => onChange({ ...payload, [name]: event.target.value })}
            className={`${INPUT_CLASS} min-w-0 flex-1`}
          />
          <button
            type="button"
            aria-label={`Bỏ trường ${name}`}
            disabled={disabled}
            onClick={() => onChange(withoutKey(payload, name))}
            className="cursor-pointer text-slate-400 hover:text-red-600 disabled:cursor-not-allowed"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <input
          aria-label="Tên trường mới"
          placeholder="tên trường"
          value={newKey}
          disabled={disabled}
          onChange={(event) => setNewKey(event.target.value)}
          onKeyDown={addOnEnter}
          className={`${INPUT_CLASS} w-20 shrink-0`}
          style={{ fontFamily: 'var(--font-mono)' }}
        />
        <input
          aria-label="Giá trị trường mới"
          placeholder="giá trị"
          value={newValue}
          disabled={disabled}
          onChange={(event) => setNewValue(event.target.value)}
          onKeyDown={addOnEnter}
          className={`${INPUT_CLASS} min-w-0 flex-1`}
        />
        <button
          type="button"
          aria-label="Thêm trường"
          disabled={!canAdd}
          onClick={add}
          className="cursor-pointer rounded border border-amber-300 p-1 text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </fieldset>
  );
}
