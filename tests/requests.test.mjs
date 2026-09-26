import {test} from 'node:test';
import assert from 'node:assert/strict';
import {safeReturnPath, validOrigin, imageUrl} from '../lib/request.ts';

test('sign-in redirects cannot leave the journal', () => {
  for (const value of ['https://evil.test', '//evil.test', '/\\evil.test', '/\nevil.test', null]) {
    assert.equal(safeReturnPath(value), '/');
  }
  assert.equal(safeReturnPath('/studio?edit=sample-1'), '/studio?edit=sample-1');
});
test('write endpoints require the same origin', () => {
  const req = origin => new Request('https://journal.test/api/journal', {method:'POST', headers: origin ? {origin} : {}});
  assert.equal(validOrigin(req('https://journal.test')), true);
  assert.equal(validOrigin(req('https://evil.test')), false);
  assert.equal(validOrigin(req(null)), false);
});
test('image links accept normal assets and reject executable URLs', () => {
  assert.equal(imageUrl('/landscape.jpg'), '/landscape.jpg');
  assert.equal(imageUrl('https://project.supabase.co/storage/image.jpg'), 'https://project.supabase.co/storage/image.jpg');
  for (const value of ['javascript:alert(1)', 'data:text/html,test', '//evil.test/image.jpg', 'https://user:pass@example.test/a']) {
    assert.throws(() => imageUrl(value));
  }
});
