import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdirSync, mkdtempSync, writeFileSync} from 'fs'
import os from 'os'
import path from 'path'

const root = mkdtempSync(path.join(os.tmpdir(), 'kb-visual-gallery-'))
process.env['KB_VISUAL_RESULTS'] = root
const {galleryHtml, galleryRows} = await import('./gallery.mts')

const png = (sha: string, platform: string, file: string) => {
  const dir = path.join(root, 'base', sha, platform, 'light')
  mkdirSync(dir, {recursive: true})
  writeFileSync(path.join(dir, file), '')
}

await test('rows join both platforms by id and mark a missing shot', () => {
  png('d1', 'desktop', 'modal__team-leave.png')
  png('d1', 'desktop', 'tab__chat.png')
  png('i1', 'ios', 'modal__team-leave.png')
  const rows = galleryRows([
    {platform: 'desktop', sha: 'd1'},
    {platform: 'ios', sha: 'i1'},
  ])
  assert.deepEqual(rows, [
    {
      id: 'modal/team-leave',
      shots: [path.join('base', 'd1', 'desktop', 'light', 'modal__team-leave.png'), path.join('base', 'i1', 'ios', 'light', 'modal__team-leave.png')],
    },
    {id: 'tab/chat', shots: [path.join('base', 'd1', 'desktop', 'light', 'tab__chat.png'), undefined]},
  ])
})

await test('the page escapes ids and keys notes by the bases shown', () => {
  const html = galleryHtml([{platform: 'desktop', sha: 'abc'}], [{id: 'a/<b>', shots: [undefined]}])
  assert.match(html, /a\/&lt;b&gt;/)
  assert.doesNotMatch(html, /<h2>a\/<b>/)
  assert.match(html, /"notes-abc"/)
  assert.match(html, /not captured/)
})

await test('each column is labeled by its device and can be hidden', () => {
  png('s1', 'ios', 'tab__chat.png')
  png('s1', 'ios-duo-folded', 'tab__chat.png')
  png('s1', 'ios-duo-unfolded', 'tab__chat.png')
  const columns = [
    {platform: 'ios' as const, sha: 's1'},
    {platform: 'ios-duo-folded' as const, sha: 's1'},
    {platform: 'ios-duo-unfolded' as const, sha: 's1'},
  ]
  const html = galleryHtml(columns, galleryRows(columns))
  for (const [col, label] of [
    ['ios', 'iPhone'],
    ['ios-duo-folded', 'iPhone Duo Folded'],
    ['ios-duo-unfolded', 'iPhone Duo Unfolded'],
  ]) {
    assert.match(html, new RegExp(`<label><input type="checkbox" class="col" data-col="${col}" checked> ${label}</label>`))
    assert.match(html, new RegExp(`<figure class="${col}" data-col="${col}">.*?<figcaption>${label}</figcaption>`))
  }
})
