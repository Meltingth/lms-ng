import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FullscreenButton } from './FullscreenButton';

const originals = {
  requestFullscreen: Object.getOwnPropertyDescriptor(document.documentElement, 'requestFullscreen'),
  exitFullscreen: Object.getOwnPropertyDescriptor(document, 'exitFullscreen'),
  fullscreenElement: Object.getOwnPropertyDescriptor(document, 'fullscreenElement'),
  fullscreenEnabled: Object.getOwnPropertyDescriptor(document, 'fullscreenEnabled'),
};
let fullscreenElement: Element | null;
const changeFullscreen = (element: Element | null) => {
  fullscreenElement = element;
  document.dispatchEvent(new Event('fullscreenchange'));
};
const requestFullscreen = vi.fn(async () => changeFullscreen(document.documentElement));
const exitFullscreen = vi.fn(async () => changeFullscreen(null));

beforeEach(() => {
  fullscreenElement = null;
  requestFullscreen.mockReset().mockImplementation(async () => changeFullscreen(document.documentElement));
  exitFullscreen.mockReset().mockImplementation(async () => changeFullscreen(null));
  Object.defineProperty(document.documentElement, 'requestFullscreen', { configurable: true, value: requestFullscreen });
  Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exitFullscreen });
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreenElement });
  Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
});

afterEach(() => {
  for (const [key, descriptor] of Object.entries(originals)) {
    const target = key === 'requestFullscreen' ? document.documentElement : document;
    if (descriptor) Object.defineProperty(target, key, descriptor);
    else Reflect.deleteProperty(target, key);
  }
});

describe('Fullscreen control', () => {
  it('enters fullscreen for the complete document only after an operator click', async () => {
    render(<FullscreenButton />);
    expect(requestFullscreen).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Full Screen' })));
    expect(requestFullscreen).toHaveBeenCalledOnce();
    expect(requestFullscreen.mock.contexts[0]).toBe(document.documentElement);
    expect(screen.getByRole('button', { name: 'Exit Full Screen' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('recognizes existing fullscreen and lets the operator exit', async () => {
    fullscreenElement = document.documentElement;
    render(<FullscreenButton />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Exit Full Screen' })));
    expect(exitFullscreen).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Full Screen' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('follows fullscreenchange events including browser Escape without another click', () => {
    render(<FullscreenButton />);
    act(() => changeFullscreen(document.documentElement));
    expect(screen.getByRole('button', { name: 'Exit Full Screen' })).toBeEnabled();
    act(() => changeFullscreen(null));
    expect(screen.getByRole('button', { name: 'Full Screen' })).toHaveAttribute('aria-pressed', 'false');
    expect(exitFullscreen).not.toHaveBeenCalled();
  });

  it('prevents duplicate requests while fullscreen permission is pending', async () => {
    let finishRequest!: () => void;
    requestFullscreen.mockImplementationOnce(() => new Promise<void>(resolve => { finishRequest = resolve; }));
    render(<FullscreenButton />);
    const button = screen.getByRole('button', { name: 'Full Screen' });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button);
    expect(requestFullscreen).toHaveBeenCalledOnce();
    await act(async () => { changeFullscreen(document.documentElement); finishRequest(); });
    expect(screen.getByRole('button', { name: 'Exit Full Screen' })).toBeEnabled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'false');
  });

  it('announces a denied request with an F11 fallback and permits retry', async () => {
    requestFullscreen.mockRejectedValueOnce(new Error('Denied by browser'));
    render(<FullscreenButton />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Full Screen' })));
    const button = screen.getByRole('button', { name: 'Full Screen' });
    expect(button).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent('เปิด Full Screen ไม่สำเร็จ — กด F11 เพื่อแสดงเต็มจอ');
    expect(button).toHaveAccessibleDescription('เปิด Full Screen ไม่สำเร็จ — กด F11 เพื่อแสดงเต็มจอ');
    await act(async () => fireEvent.click(button));
    expect(screen.getByRole('button', { name: 'Exit Full Screen' })).toBeEnabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps the exit control truthful when the browser rejects exiting', async () => {
    fullscreenElement = document.documentElement;
    exitFullscreen.mockRejectedValueOnce(new Error('Exit failed'));
    render(<FullscreenButton />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Exit Full Screen' })));
    expect(screen.getByRole('button', { name: 'Exit Full Screen' })).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent('กด Esc หรือ F11');
  });

  it('disables the control and provides a keyboard fallback without a native API', () => {
    Object.defineProperty(document.documentElement, 'requestFullscreen', { configurable: true, value: undefined });
    render(<FullscreenButton />);
    const button = screen.getByRole('button', { name: 'Full Screen' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('เบราว์เซอร์นี้ไม่รองรับ Full Screen — กด F11 เพื่อแสดงเต็มจอ');
    fireEvent.click(button);
    expect(requestFullscreen).not.toHaveBeenCalled();
  });

  it('respects a browser or embedding policy that disables fullscreen', () => {
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: false });
    render(<FullscreenButton />);
    expect(screen.getByRole('button', { name: 'Full Screen' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('F11');
  });
});
