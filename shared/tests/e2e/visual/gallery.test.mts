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

await test('a column can show a render run instead of a base', () => {
  png('r1', 'ios', 'tab__chat.png')
  const render = path.join(root, 'render', '2026-11-17T00-00-00')
  mkdirSync(render, {recursive: true})
  writeFileSync(path.join(render, 'tab__chat.png'), '')
  writeFileSync(path.join(render, 'tab__git.png'), '')
  const columns = [
    {platform: 'ios' as const, sha: 'r1'},
    {platform: 'ios-duo-split-left' as const, render},
  ]
  assert.deepEqual(galleryRows(columns), [
    {id: 'tab/chat', shots: [path.join('base', 'r1', 'ios', 'light', 'tab__chat.png'), path.join('render', '2026-11-17T00-00-00', 'tab__chat.png')]},
    {id: 'tab/git', shots: [undefined, path.join('render', '2026-11-17T00-00-00', 'tab__git.png')]},
  ])
  assert.match(galleryHtml(columns, galleryRows(columns)), /iPhone Duo Split Left render 2026-11-17T00-00-00/)
})

await test('newestRender finds the newest render run of a store target', async () => {
  const {newestRender} = await import('./store.mts')
  for (const [stamp, platform] of [['2026-11-17T01-00-00', 'ios-duo-folded'], ['2026-11-17T02-00-00', 'ios'], ['2026-11-17T00-30-00', 'ios-duo-folded']]) {
    const dir = path.join(root, 'render', stamp!)
    mkdirSync(dir, {recursive: true})
    writeFileSync(path.join(dir, 'render.json'), JSON.stringify({platform}))
  }
  assert.equal(newestRender('ios-duo-folded'), path.join(root, 'render', '2026-11-17T01-00-00'))
  assert.equal(newestRender('ios-duo-unfolded'), undefined)
})
