// End-to-end test: loads the sample export into the tool, copies the cleanup script,
// and runs it against a mock Instagram site (no real Instagram involved).
//
//   npm install
//   npm test
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { deflateRawSync, crc32 } from 'node:zlib';
import { writeFileSync, mkdtempSync } from 'node:fs';
import os from 'node:os';

// Minimal ZIP writer (deflate), so the test can build a realistic Instagram export.
function makeZip(files){
  const locals = [], centrals = []; let offset = 0;
  for (const [name, text] of files){
    const raw = Buffer.from(text), data = deflateRawSync(raw), nameBuf = Buffer.from(name), crc = crc32(raw);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nameBuf.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt32LE(offset, 42);
    locals.push(lh, nameBuf, data); centrals.push(ch, nameBuf); offset += 30 + nameBuf.length + data.length;
  }
  const cd = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const toolUrl = 'file://' + path.join(root, 'index.html');
const sample = f => path.join(root, 'sample-data', f);

// How each mock profile starts out
const STATES = { 'old.friend.2016': 'Requested', 'private.chef': 'Following', 'hidden.trails': 'Follow' };

const profile = u => `<!doctype html><html><body>
<header><h2>${u}</h2><div id="b"></div></header>
<section><div role="button">Follow</div> (suggested account)</section>
<script>
  const b = document.getElementById('b');
  function set(t){
    b.innerHTML = '<button><div><div>' + t + '</div></div></button>';
    b.firstChild.onclick = () => {
      if (t === 'Follow') return;
      const d = document.createElement('div'); d.setAttribute('role', 'dialog');
      d.innerHTML = t === 'Requested'
        ? '<div>Unfollow @${u}?</div><button>Unfollow</button><button>Cancel</button>'
        : '<div role="button"><span>Mute</span></div><div role="button"><div><span>Unfollow</span></div></div>';
      document.body.appendChild(d);
      d.querySelectorAll('button,[role=button]').forEach(x => x.onclick = () => {
        if (x.innerText.trim() === 'Unfollow') setTimeout(() => set('Follow'), 300);
        d.remove();
      });
    };
  }
  setTimeout(() => set(${JSON.stringify(STATES[u] || 'Requested')}), 500);
</script></body></html>`;

const browser = await chromium.launch();
const ctx = await browser.newContext();
await ctx.route('https://www.instagram.com/**', r => {
  const u = new URL(r.request().url()).pathname.split('/')[1];
  r.fulfill({ contentType: 'text/html', body: u ? profile(u) : '<html><body>home</body></html>' });
});

// 1. Tool: load sample data, pick 3 pending requests, copy the script
const tool = await ctx.newPage();
const toolErrors = [];
tool.on('pageerror', e => toolErrors.push(e.message));
tool.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) toolErrors.push('network request: ' + r.url()); });
await tool.goto(toolUrl);
await tool.setInputFiles('#fileIn', ['followers_1.json', 'following.json', 'pending_follow_requests.json'].map(sample));
await tool.waitForFunction(() => /pending/.test(document.querySelector('#loadedBar')?.innerText || ''));
const loaded = await tool.innerText('#loadedBar');
assert.match(loaded, /14\s+following/);
assert.match(loaded, /12\s+followers/);
assert.match(loaded, /8\s+pending/);

await tool.click('[data-t=pending]');
await tool.fill('#lim', '3');
await tool.click('#pickNext');
assert.equal(await tool.innerText('#selCount'), '3 selected');
await tool.evaluate(() => { navigator.clipboard.writeText = async t => { window.__clip = t; }; });
await tool.click('#copyScript');
let script = await tool.evaluate(() => window.__clip);
assert.ok(script && script.includes('igRunner'), 'script was copied');
script = script.replace(/, \d+, \d+, 3\);\s*$/, ', 1, 1, 3);'); // no waiting in tests

// 2. "Instagram": paste the script, click Start
const ig = await ctx.newPage();
await ig.goto('https://www.instagram.com/');
ig.evaluate(script);
await ig.waitForSelector('#igc-start');
await ig.click('#igc-start');
await ig.waitForFunction(() => /Finished|Stopp/.test(document.querySelector('#igc-status')?.textContent || ''), null, { timeout: 60000 });
const finished = (await ig.inputValue('#igc-done')).split('\n').filter(Boolean);
assert.deepEqual(finished, ['old.friend.2016', 'private.chef', 'hidden.trails']);

// 3. Tool: paste the finished list back
await tool.fill('#doneIn', finished.join('\n'));
await tool.click('#applyDone');
assert.match(await tool.innerText('#tabs'), /Pending requests\s*5/);

// 4. Sample data must not touch the user's real Keep/Done marks
await tool.evaluate(() => localStorage.setItem('igc_keep', JSON.stringify(['real.friend'])));
await tool.reload();
await tool.click('#demoBtn');
await tool.click('.keep-btn');
assert.equal(await tool.evaluate(() => localStorage.getItem('igc_keep')), '["real.friend"]', 'demo left real marks alone');
await tool.click('#clearData'); // "Close sample data" brings the real lists back
await tool.waitForFunction(() => /Restored/.test(document.querySelector('#loadReport')?.innerText || ''));

// 5. A full ZIP export: split follower files in any order, other export files ignored
const dir = 'connections/followers_and_following/';
const item = u => ({ title: '', media_list_data: [], string_list_data: [{ href: 'https://www.instagram.com/' + u, value: u, timestamp: 1600000000 }] });
const range = (a, b) => Array.from({ length: b - a }, (_, i) => 'user' + (a + i));
const zipPath = path.join(mkdtempSync(path.join(os.tmpdir(), 'igc-')), 'export.zip');
writeFileSync(zipPath, makeZip([
  [dir + 'followers_2.json', JSON.stringify(range(100, 150).map(item))],
  [dir + 'followers_1.json', JSON.stringify(range(0, 100).map(item))],
  [dir + 'following.json', JSON.stringify({ relationships_following: range(0, 10).map(u => ({ title: u, string_list_data: [{ href: 'https://www.instagram.com/_u/' + u, timestamp: 1 }] })) })],
  [dir + 'following_hashtags.json', JSON.stringify({ relationships_following_hashtags: [item('sometag')] })],
  [dir + 'recently_unfollowed_profiles.json', JSON.stringify({ relationships_unfollowed_users: [item('gone.user')] })],
  [dir + "follow_requests_you've_received.json", JSON.stringify({ relationships_follow_requests_received: [item('fan')] })]
]));
await tool.setInputFiles('#fileIn', zipPath);
await tool.waitForFunction(() => /150/.test(document.querySelector('#loadedBar')?.innerText || ''));
const zipLoaded = await tool.innerText('#loadedBar');
assert.match(zipLoaded, /10\s+following/, 'hashtags are not counted as accounts');
assert.match(zipLoaded, /150\s+followers/, 'followers_1 and followers_2 are combined');
assert.match(zipLoaded, /0\s+pending/, 'a full export replaces the old pending list');

assert.deepEqual(toolErrors, [], 'tool had no errors and made no network requests');
await browser.close();
console.log('✓ All checks passed');
