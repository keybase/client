import * as fs from 'fs'
import * as path from 'path'
import {checkDelete, parseKbfsLs, selectSweepTargets, type SweepCandidate, type SweepContext} from './sweep-lib'

const before = Date.UTC(2026, 9, 27, 12, 0)
// run ids (see run-id.ts): 98s0 is 12:00Z on 2026-10-27, 98rz 11:59, 98qc 11:00
const ctx: SweepContext = {
  before,
  currentRunId: '98s0b1',
  seededChannels: ['e2e-long', 'e2e-scratch'],
  seededSubteams: ['e2eclosed'],
  team: 'testteam',
  users: {second: 'testuser-mac', smoke: 'testuser'},
}
const old = '98qca1'
const smoke = (c: Omit<SweepCandidate, 'account'>): SweepCandidate => ({account: 'smoke', ...c})
const decide = (c: SweepCandidate) => {
  const r = selectSweepTargets([c], ctx)
  if (r.delete.length) return 'delete'
  if (r.listOnly.length) return `list: ${r.listOnly[0]?.reason}`
  if (r.kept.length) return `kept: ${r.kept[0]?.reason}`
  return 'dropped'
}

describe('selectSweepTargets', () => {
  test('a run-stamped channel from an earlier run is deleted', () => {
    expect(decide(smoke({kind: 'channel', name: `e2e-${old}-x`}))).toBe('delete')
  })

  test('keeps the seeded channels and subteam', () => {
    expect(decide(smoke({kind: 'channel', name: 'e2e-long'}))).toMatch(/^kept: seeded/)
    expect(decide(smoke({kind: 'subteam', name: 'testteam.e2eclosed'}))).toMatch(/^kept: seeded/)
  })

  test('keeps the peer devices, lists other e2e devices', () => {
    expect(decide(smoke({kind: 'device', name: 'e2e-owner-svc-2'}))).toMatch(/^kept: peer device/)
    expect(decide({account: 'second', kind: 'device', name: 'e2e-second-svc'})).toMatch(/^kept: peer device/)
    expect(decide(smoke({kind: 'device', name: `e2e-${old}-desk`}))).toMatch(/^list: /)
    expect(decide(smoke({kind: 'device', name: 'e2e-owner-svc-x'}))).toMatch(/^list: /)
  })

  test('keeps objects of the current run and of runs that started after `before`', () => {
    expect(decide(smoke({kind: 'channel', name: `e2e-${ctx.currentRunId}-x`}))).toMatch(/^kept: made by this run/)
    expect(decide(smoke({kind: 'channel', name: 'e2e-98s0a1-x'}))).toMatch(/^kept: .*not before/)
    expect(decide(smoke({kind: 'channel', name: 'e2e-98rza1-x'}))).toBe('delete')
  })

  test('drops names without the prefix', () => {
    expect(decide(smoke({kind: 'channel', name: 'general'}))).toBe('dropped')
    expect(decide(smoke({kind: 'repo', name: `x-e2e-${old}-r`}))).toBe('dropped')
    expect(decide(smoke({kind: 'email', name: `me+e2e-${old}-m@example.com`}))).toBe('dropped')
    expect(decide(smoke({kind: 'team', name: 'testteamother'}))).toBe('dropped')
  })

  test('keeps e2e names in the older naming as unrecognised', () => {
    for (const name of ['e2e-vis-chan', 'e2e-leave-mh3k2a1b', 'e2e-nojoin-mh3k2a1b', 'e2e-roedit-mh3k2a1b', 'e2e-kinds', 'e2e-2610271612fb50-s']) {
      expect(decide(smoke({kind: 'channel', name}))).toMatch(/^kept: unrecognised/)
    }
    expect(decide(smoke({kind: 'repo', name: 'e2e-vis-repo'}))).toMatch(/^kept: unrecognised/)
    expect(decide(smoke({kind: 'email', name: 'e2e-vis@example.com'}))).toMatch(/^kept: unrecognised/)
    expect(decide(smoke({kind: 'kbfs', name: '/keybase/private/testuser/e2e-pdf-preview.pdf'}))).toMatch(/^kept: unrecognised/)
  })

  test('emails: an old run-stamped one is deleted, a primary one only listed', () => {
    expect(decide(smoke({kind: 'email', name: `e2e-${old}-m@example.com`}))).toBe('delete')
    expect(decide(smoke({kind: 'email', name: `e2e-${old}-m@example.com`, primary: true}))).toMatch(/^list: /)
  })

  test('teams and subteams: stamped and older than `before` is a delete target', () => {
    expect(decide(smoke({kind: 'team', name: `e2e${old}t`}))).toBe('delete')
    expect(decide({account: 'second', kind: 'team', name: `e2e${old}t`})).toBe('delete')
    expect(decide(smoke({kind: 'subteam', name: `testteam.e2e${old}t`}))).toBe('delete')
  })

  test('teams and subteams: the current run, newer runs and unstamped names are kept', () => {
    expect(decide(smoke({kind: 'team', name: `e2e${ctx.currentRunId}t`}))).toMatch(/^kept: made by this run/)
    expect(decide(smoke({kind: 'subteam', name: `testteam.e2e${ctx.currentRunId}t`}))).toMatch(/^kept: made by this run/)
    expect(decide(smoke({kind: 'team', name: 'e2e98s0a1t'}))).toMatch(/^kept: .*not before/)
    expect(decide(smoke({kind: 'team', name: 'e2eteam'}))).toMatch(/^kept: unrecognised/)
    // a subteam of some other team, or a deeper one, is not ours to judge
    expect(decide(smoke({kind: 'subteam', name: `otherteam.e2e${old}t`}))).toBe('dropped')
    expect(decide(smoke({kind: 'subteam', name: `testteam.x.e2e${old}t`}))).toBe('dropped')
  })

  test('subteams are deleted before their parents', () => {
    const r = selectSweepTargets(
      [
        smoke({kind: 'team', name: `e2e${old}t`}),
        smoke({kind: 'channel', name: `e2e-${old}-x`}),
        smoke({kind: 'subteam', name: `testteam.e2e${old}s`}),
      ],
      ctx
    )
    expect(r.delete.map(c => c.kind)).toEqual(['subteam', 'team', 'channel'])
  })

  test('kbfs: an entry directly in the smoke folders is deleted', () => {
    expect(decide(smoke({kind: 'kbfs', name: `/keybase/private/testuser/e2e-${old}-f`}))).toBe('delete')
    expect(decide(smoke({kind: 'kbfs', name: `/keybase/team/testteam/e2e-${old}-f`}))).toBe('delete')
  })

  test('kbfs: refuses a path outside the account folder', () => {
    const refused = [
      `/keybase/private/testuser-mac/e2e-${old}-f`, // the other account's folder
      `/keybase/private/testuser,testuser-mac/e2e-${old}-f`,
      `/keybase/public/testuser/e2e-${old}-f`,
      `/keybase/private/testuser/sub/e2e-${old}-f`,
      `/keybase/private/testuser/../testuser-mac/e2e-${old}-f`,
      `/keybase/private/testuser//e2e-${old}-f`,
      `keybase/private/testuser/e2e-${old}-f`,
    ]
    for (const name of refused) expect(decide(smoke({kind: 'kbfs', name}))).toMatch(/^kept: refused/)
  })

  test('kbfs: the second account sweeps none (its peer runs no KBFS)', () => {
    expect(decide({account: 'second', kind: 'kbfs', name: `/keybase/private/testuser-mac/e2e-${old}-f`})).toMatch(/^kept: refused/)
    expect(decide({account: 'second', kind: 'kbfs', name: `/keybase/team/testteam/e2e-${old}-f`})).toMatch(/^kept: refused/)
  })

  test('kbfs: a directory is removed only when empty', () => {
    const dir = `/keybase/private/testuser/e2e-${old}-d`
    expect(decide(smoke({dir: {empty: false}, kind: 'kbfs', name: dir}))).toMatch(/^list: .*not empty/)
    expect(decide(smoke({dir: {empty: true}, kind: 'kbfs', name: dir}))).toBe('delete')
  })
})

describe('checkDelete', () => {
  const target = smoke({kind: 'channel', name: `e2e-${old}-x`})
  test('passes for a delete target acted on by its own account', () => {
    expect(() => checkDelete(target, ctx, 'testuser')).not.toThrow()
  })
  test('refuses when the acting account is not the one the target belongs to', () => {
    expect(() => checkDelete(target, ctx, 'testuser-mac')).toThrow(/signed in as testuser-mac/)
    expect(() => checkDelete(target, ctx, '')).toThrow(/signed in as nobody/)
  })
  test('refuses anything the selection would not delete', () => {
    expect(() => checkDelete(smoke({kind: 'channel', name: 'e2e-long'}), ctx, 'testuser')).toThrow(/seeded/)
    expect(() => checkDelete(smoke({kind: 'kbfs', name: `/keybase/private/testuser/x/e2e-${old}-f`}), ctx, 'testuser')).toThrow(
      /refused/
    )
    expect(() => checkDelete(smoke({kind: 'channel', name: 'general'}), ctx, 'testuser')).toThrow(/no e2e prefix/)
  })
  test('refuses a listed-only target: a run-stamped device', () => {
    expect(() => checkDelete(smoke({kind: 'device', name: `e2e-${old}-desk`}), ctx, 'testuser')).toThrow(/not revoked/)
  })
})

describe('parseKbfsLs', () => {
  test('reads a captured `keybase fs ls -w -a --nocolor` listing', () => {
    const out = fs.readFileSync(path.join(__dirname, '__fixtures__', 'kbfs-ls-w.txt'), 'utf8')
    expect(parseKbfsLs(out)).toEqual([
      {isDir: false, name: 'e2e-pdf-preview.pdf'},
      {isDir: false, name: 'e2e-98zfa2-f'},
      {isDir: true, name: 'e2e-98zfa2-d'},
    ])
  })
  test('an empty directory lists nothing', () => {
    expect(parseKbfsLs('')).toEqual([])
  })
})
