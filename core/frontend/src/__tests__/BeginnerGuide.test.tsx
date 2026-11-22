import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { GlossaryModal, LabBeginnerCard } from '@/components';
import {
  filterGlossary,
  findGlossaryEntry,
  getLabBeginnerGuide,
  LAB_BEGINNER_GUIDES,
  SECURITY_GLOSSARY,
} from '@/lib';
import type { LabMetadata } from '@/types';

const ALL_LAB_IDS = [
  '01-sql-injection',
  '02-stored-xss',
  '03-idor',
  '04-business-logic',
  '05-mass-assignment',
  '06-path-traversal',
  '07-file-upload',
  '08-race-condition',
  '09-ssrf',
] as const;

function makeLab(overrides: Partial<LabMetadata> = {}): LabMetadata {
  return {
    id: '01-sql-injection',
    title: 'SQL Injection',
    category: 'Injection',
    difficulty: 'Cơ bản',
    summary: 'Mô tả tóm tắt bài lab.',
    safetyPattern: 'Dùng Parameterized Query.',
    samplePayloads: [],
    verifyTests: [],
    ...overrides,
  };
}

describe('beginnerContent', () => {
  it('provides complete beginner guides and valid glossary terms for all 9 labs', () => {
    expect(Object.keys(LAB_BEGINNER_GUIDES)).toHaveLength(9);
    for (const id of ALL_LAB_IDS) {
      const guide = getLabBeginnerGuide(makeLab({ id }));
      expect(guide.labId).toBe(id);
      expect(guide.everydayAnalogy.length).toBeGreaterThan(20);
      expect(guide.whyDangerous.length).toBeGreaterThan(20);
      expect(guide.tryFirstHint.length).toBeGreaterThan(20);
      expect(guide.fixFiles.length).toBeGreaterThanOrEqual(1);
      expect(guide.relatedTermIds.length).toBeGreaterThanOrEqual(2);
      for (const termId of guide.relatedTermIds) {
        expect(findGlossaryEntry(termId)).toBeDefined();
      }
    }

    const lab02 = getLabBeginnerGuide(makeLab({ id: '02-stored-xss' }));
    expect(lab02.fixFiles).toContain('labs/02-stored-xss/frontend/vulnerable.tsx');
  });

  it('falls back cleanly for an unknown lab id', () => {
    const custom = getLabBeginnerGuide(
      makeLab({
        id: '99-custom-lab',
        summary: 'Tóm tắt lab tự tạo.',
        safetyPattern: 'Kiểm tra đầu vào chặt chẽ.',
      }),
    );
    expect(custom.labId).toBe('99-custom-lab');
    expect(custom.everydayAnalogy).toBe('Tóm tắt lab tự tạo.');
    expect(custom.fixFiles).toEqual(['labs/99-custom-lab/backend/vulnerable.py']);
  });
});

describe('securityGlossary', () => {
  it('filters entries by category and Vietnamese/English search text', () => {
    expect(SECURITY_GLOSSARY.length).toBeGreaterThanOrEqual(16);
    expect(filterGlossary('', 'all')).toHaveLength(SECURITY_GLOSSARY.length);

    const defenses = filterGlossary('', 'defense');
    expect(defenses.length).toBeGreaterThanOrEqual(3);
    expect(defenses.every((entry) => entry.category === 'defense')).toBe(true);

    const sqlMatches = filterGlossary('parameterized', 'all');
    expect(sqlMatches.some((entry) => entry.id === 'parameterized-query')).toBe(true);

    expect(filterGlossary('khong-ton-tai-xyz', 'all')).toHaveLength(0);
  });
});

describe('LabBeginnerCard', () => {
  it('toggles open/close, copies fix file path, and opens clicked glossary terms', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const onOpenTerm = vi.fn();

    render(<LabBeginnerCard lab={makeLab({ id: '01-sql-injection' })} onOpenTerm={onOpenTerm} />);

    const toggleBtn = screen.getByRole('button', { name: /Hiểu nhanh trong 30 giây/i });
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/Ví dụ đời thường/i)).not.toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Ví dụ đời thường/i)).toBeInTheDocument();
    expect(screen.getByText(/Tại sao nguy hiểm\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Thử ngay trong 10 giây/i)).toBeInTheDocument();

    const copyBtn = screen.getByRole('button', {
      name: /Sao chép đường dẫn labs\/01-sql-injection\/backend\/vulnerable\.py/i,
    });
    fireEvent.click(copyBtn);
    expect(writeText).toHaveBeenCalledWith('labs/01-sql-injection/backend/vulnerable.py');
    expect(screen.getByText('Đã chép')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /SQL Injection \(SQLi\)/i }));
    expect(onOpenTerm).toHaveBeenCalledWith('sql-injection');

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('GlossaryModal', () => {
  it('returns null when closed, highlights initialTermId, searches, filters, and closes', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <GlossaryModal isOpen={false} initialTermId="idor" onClose={onClose} />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(<GlossaryModal isOpen={true} initialTermId="idor" onClose={onClose} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();

    const highlightedItem = dialog.querySelector('[data-term-id="idor"]');
    expect(highlightedItem).toHaveAttribute('data-highlighted', 'true');
    expect(screen.getByText('Đang xem')).toBeInTheDocument();

    const defenseTab = screen.getByRole('button', { name: 'Cách phòng vệ' });
    fireEvent.click(defenseTab);
    expect(defenseTab).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('IDOR (Insecure Direct Object Reference)')).not.toBeInTheDocument();
    expect(screen.getByText('Parameterized Query ($1, $2)')).toBeInTheDocument();

    const searchInput = screen.getByRole('searchbox', { name: 'Tìm thuật ngữ bảo mật' });
    fireEvent.change(searchInput, { target: { value: 'khong-co-ket-qua' } });
    expect(screen.getByText(/Không tìm thấy thuật ngữ phù hợp/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
    expect(screen.getByText('IDOR (Insecure Direct Object Reference)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Đóng từ điển' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
