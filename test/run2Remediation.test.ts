import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { coercePagination } from '../server/lib/access.js';
import { assertPdfFlateStreamsBounded, isSafeImageDimensions } from '../server/services/pdfCompression.js';
import { decouper } from '../server/services/pdfLayout.js';

function makeChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  return Buffer.concat([len, typeBuf, data, crc]);
}

test('coercePagination clamps negative pages and huge limits', () => {
  assert.deepEqual(coercePagination('-5', '999999', 200, 200), { page: 1, limit: 200 });
  assert.deepEqual(coercePagination('0', '0', 300, 300), { page: 1, limit: 300 });
  assert.deepEqual(coercePagination('3', '50', 200, 200), { page: 3, limit: 50 });
  assert.deepEqual(coercePagination('999999', '12', 200, 200), { page: 10000, limit: 12 });
});

test('isSafeImageDimensions validates full PNG chunk structure and rejects bombs', () => {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const validIhdrData = Buffer.alloc(13);
  validIhdrData.writeUInt32BE(16, 0);
  validIhdrData.writeUInt32BE(16, 4);
  validIhdrData[8] = 8; // bit depth
  validIhdrData[9] = 6; // RGBA
  const validPng = Buffer.concat([
    sig,
    makeChunk('IHDR', validIhdrData),
    makeChunk('IDAT', Buffer.from([0x78, 0x9c, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01])),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
  assert.equal(isSafeImageDimensions(validPng), true);

  // Truncated / missing IEND PNG must be rejected
  const truncatedPng = Buffer.concat([sig, makeChunk('IHDR', validIhdrData)]);
  assert.equal(isSafeImageDimensions(truncatedPng), false);

  // Oversized zTXt chunk must be rejected
  const hugeMetaPng = Buffer.concat([
    sig,
    makeChunk('IHDR', validIhdrData),
    makeChunk('zTXt', Buffer.alloc(600 * 1024)),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
  assert.equal(isSafeImageDimensions(hugeMetaPng), false);

  // Pixel bomb (> 12M pixels) must be rejected
  const bombIhdr = Buffer.alloc(13);
  bombIhdr.writeUInt32BE(4500, 0);
  bombIhdr.writeUInt32BE(4500, 4);
  bombIhdr[8] = 8;
  bombIhdr[9] = 6;
  const bombPng = Buffer.concat([sig, makeChunk('IHDR', bombIhdr), makeChunk('IEND', Buffer.alloc(0))]);
  assert.equal(isSafeImageDimensions(bombPng), false);
});

test('assertPdfFlateStreamsBounded rejects oversized FlateDecode bomb before PDFDocument.load', () => {
  const zeroPayload = Buffer.alloc(18 * 1024 * 1024, 0x41);
  const deflated = zlib.deflateSync(zeroPayload);
  const fakePdf = Buffer.concat([
    Buffer.from('%PDF-1.4\n1 0 obj\n<< /Filter /FlateDecode /Length ' + deflated.length + ' >>\nstream\n', 'latin1'),
    deflated,
    Buffer.from('\nendstream\nendobj\n%%EOF', 'latin1'),
  ]);
  assert.throws(() => assertPdfFlateStreamsBounded(fakePdf), /décompression|excessif/i);
});

test('decouper wraps very long unspaced tokens efficiently with binary search', () => {
  const fakeFont = {
    encodeText: () => [],
    widthOfTextAtSize: (s: string, size: number) => s.length * size * 0.5,
  } as any;
  const t0 = Date.now();
  const lines = decouper('A'.repeat(20_000), fakeFont, 10, 100);
  const elapsed = Date.now() - t0;
  assert.equal(lines.length, 1000);
  assert.equal(lines[0].length, 20);
  assert.ok(elapsed < 500, `Expected <500ms, got ${elapsed}ms`);
});
