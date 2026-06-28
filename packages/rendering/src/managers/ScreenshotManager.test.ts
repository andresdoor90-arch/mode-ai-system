import { describe, it, expect } from 'vitest';

import { type IScreenshotSink } from '../abstraction/engine';
import { type ScreenshotRequest, type ScreenshotResult } from '../abstraction/types';
import { ScreenshotManager } from './ScreenshotManager';

/** A fake sink that echoes the request back as a result and records calls. */
class FakeSink implements IScreenshotSink {
  public calls: ScreenshotRequest[] = [];

  public captureScreenshot(request: ScreenshotRequest): Promise<ScreenshotResult> {
    this.calls.push(request);
    return Promise.resolve({
      dataUrl: `data:${request.format};base64,AAAA`,
      width: request.width,
      height: request.height,
      format: request.format,
      fileName: request.fileName,
      capturedAt: '2026-07-03T00:00:00.000Z',
    });
  }
}

const fixedNow = (): Date => new Date('2026-07-03T12:34:56.000Z');

describe('ScreenshotManager', () => {
  it('builds a descriptive, timestamped PNG filename per view', () => {
    const sm = new ScreenshotManager(new FakeSink(), fixedNow);
    const req = sm.buildRequest('Más elegante', { view: 'left' });
    expect(req.format).toBe('image/png');
    expect(req.view).toBe('left');
    expect(req.fileName).toMatch(/^mas-tryon_m-s-elegante_left_.*\.png$/);
    expect(req.quality).toBeUndefined();
  });

  it('sets JPEG quality and extension for jpeg captures', () => {
    const sm = new ScreenshotManager(new FakeSink(), fixedNow);
    const req = sm.buildRequest('Principal', { format: 'image/jpeg', quality: 0.5 });
    expect(req.fileName.endsWith('.jpg')).toBe(true);
    expect(req.quality).toBe(0.5);
  });

  it('clamps dimensions into a safe range', () => {
    const sm = new ScreenshotManager(new FakeSink(), fixedNow);
    expect(sm.buildRequest('o', { width: 1, height: 999999 }).width).toBe(16);
    expect(sm.buildRequest('o', { width: 1, height: 999999 }).height).toBe(8192);
  });

  it('delegates capture to the sink and returns its result', async () => {
    const sink = new FakeSink();
    const sm = new ScreenshotManager(sink, fixedNow);
    const result = await sm.capture('Principal', { view: 'front', format: 'image/png' });
    expect(sink.calls).toHaveLength(1);
    expect(result.dataUrl.startsWith('data:image/png')).toBe(true);
    expect(result.fileName).toBe(sink.calls[0]?.fileName);
  });

  it('falls back to a default label slug when empty', () => {
    const sm = new ScreenshotManager(new FakeSink(), fixedNow);
    expect(sm.buildRequest('').fileName).toMatch(/^mas-tryon_mas_front_/);
  });
});
