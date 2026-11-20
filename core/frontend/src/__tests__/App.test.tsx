import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { App } from '@/App';

describe('App skeleton', () => {
  it('renders both Dual-Surface Pedagogy panels', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'ok',
          service: 'Visual Vulnerable Web App API',
          version: '0.1.0',
          environment: 'test',
        }),
      }),
    );

    render(<App />);

    expect(screen.getByText('MiniShop Sandbox')).toBeInTheDocument();
    expect(screen.getByText('Code & Trace Inspector')).toBeInTheDocument();
    expect(await screen.findByText(/API: OK/)).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
