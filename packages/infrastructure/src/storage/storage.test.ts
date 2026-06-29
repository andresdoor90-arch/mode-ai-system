import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { StorageError } from '../errors/InfrastructureError';
import { buildStorageKey, contentTypeForExtension } from './FileStorage';
import { ImageStorageService } from './ImageStorage';
import { LocalFileStorage } from './LocalFileStorage';

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

describe('FileStorage helpers', () => {
  it('builds a sharded, sanitised key', () => {
    const key = buildStorageKey('images', 'AbCd1234', 'png');
    expect(key).toBe('images/ab/AbCd1234.png');
  });

  it('maps known extensions to content types', () => {
    expect(contentTypeForExtension('png')).toBe('image/png');
    expect(contentTypeForExtension('JPG')).toBe('image/jpeg');
    expect(contentTypeForExtension('xyz')).toBeNull();
    expect(contentTypeForExtension(undefined)).toBeNull();
  });
});

describe('LocalFileStorage', () => {
  let dir: string;
  let storage: LocalFileStorage;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mas-store-'));
    storage = new LocalFileStorage(dir);
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('saves and reads bytes round-trip', async () => {
    const stored = await storage.saveAs('files/aa/hello.txt', bytes('hello world'), {
      contentType: 'text/plain',
    });
    expect(stored.size).toBe(11);
    const read = await storage.read('files/aa/hello.txt');
    expect(new TextDecoder().decode(read)).toBe('hello world');
  });

  it('reports existence and deletes', async () => {
    await storage.saveAs('files/aa/x.bin', bytes('x'));
    expect(await storage.exists('files/aa/x.bin')).toBe(true);
    await storage.delete('files/aa/x.bin');
    expect(await storage.exists('files/aa/x.bin')).toBe(false);
  });

  it('lists keys under a prefix', async () => {
    await storage.saveAs('images/aa/1.png', bytes('1'));
    await storage.saveAs('images/bb/2.png', bytes('2'));
    await storage.saveAs('docs/cc/3.txt', bytes('3'));
    const images = await storage.list('images');
    expect([...images].sort()).toEqual(['images/aa/1.png', 'images/bb/2.png']);
  });

  it('rejects path traversal outside the root', () => {
    expect(() => storage.resolvePath('../escape.txt')).toThrow(StorageError);
  });

  it('rejects reading a missing key with a StorageError', async () => {
    await expect(storage.read('files/zz/missing.bin')).rejects.toBeInstanceOf(StorageError);
  });
});

describe('ImageStorageService', () => {
  let dir: string;
  let images: ImageStorageService;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mas-img-'));
    images = new ImageStorageService(new LocalFileStorage(dir), 1024);
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('stores an image and returns metadata', async () => {
    const meta = await images.saveImage(bytes('PNGDATA'), {
      extension: 'png',
      originalName: 'shirt.png',
    });
    expect(meta.key).toMatch(/^images\//);
    expect(meta.contentType).toBe('image/png');
    expect(meta.originalName).toBe('shirt.png');
    expect(await images.hasImage(meta.key)).toBe(true);
  });

  it('rejects empty, oversized and unsupported images', async () => {
    await expect(images.saveImage(new Uint8Array(0), { extension: 'png' })).rejects.toBeInstanceOf(
      StorageError,
    );
    await expect(
      images.saveImage(new Uint8Array(2048), { extension: 'png' }),
    ).rejects.toBeInstanceOf(StorageError);
    await expect(images.saveImage(bytes('x'), { extension: 'exe' })).rejects.toBeInstanceOf(
      StorageError,
    );
  });

  it('prunes orphaned images not in the referenced set', async () => {
    const keep = await images.saveImage(bytes('a'), { extension: 'png' });
    const drop = await images.saveImage(bytes('b'), { extension: 'png' });
    const removed = await images.pruneOrphans([keep.key]);
    expect(removed).toEqual([drop.key]);
    expect(await images.hasImage(keep.key)).toBe(true);
    expect(await images.hasImage(drop.key)).toBe(false);
  });
});
