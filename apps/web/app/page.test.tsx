import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { messages } from '@bingetrail/i18n';

import HomePage from './page';

describe('HomePage', () => {
  it('renders the app name and Turkish tagline', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { level: 1, name: 'BingeTrail' })).toBeTruthy();
    expect(screen.getByText(messages.tr.app.tagline)).toBeTruthy();
  });
});
