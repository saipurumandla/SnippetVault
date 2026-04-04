import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import Header from './Header';
import { renderPage } from '../test/render';

describe('Header shortcuts', () => {
  it('N opens a new snippet', () => {
    renderPage(<Header />, { path: '/vault' });
    fireEvent.keyDown(document.body, { key: 'n' });
    expect(screen.getByTestId('location')).toHaveTextContent('/snippet/new');
  });

  it('N inside the code editor is just a letter', () => {
    renderPage(
      <div>
        <Header />
        <div className="monaco-editor"><div data-testid="editor-input" tabIndex={0} /></div>
      </div>,
      { path: '/snippet/7/edit' },
    );
    const event = fireEvent.keyDown(screen.getByTestId('editor-input'), { key: 'n' });
    expect(event).toBe(true);
    expect(screen.getByTestId('location')).toHaveTextContent('/snippet/7/edit');
  });

  it('/ focuses search only when there is a search box', () => {
    renderPage(<Header onSearch={() => {}} searchValue="" />, { path: '/vault' });
    fireEvent.keyDown(document.body, { key: '/' });
    expect(screen.getByLabelText('Search snippets')).toHaveFocus();
  });
});
