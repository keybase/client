import * as fs from 'fs'
import * as path from 'path'
import {checkDelete, kbfsRoots, listedEmojiAlias, parseKbfsLs, selectSweepTargets, type SweepCandidate, type SweepContext} from './sweep-lib'

const before = Date.UTC(2026, 9, 27, 12, 0)
// run ids (see run-id.ts): 98s0 is 12:00Z on 2026-10-27, 98rz 11:59, 98qc 11:00
const ctx: SweepContext = {
  before,
  currentRunId: '98s0b1',
  messageConvs: {direct: 'aa01', scratch: 'aa02', self: 'aa03'},
  paperKeys: [
    {deviceID: 'dd01', deviceName: 'apple banana', runId: '98qca1'},
    {deviceID: 'dd02', deviceName: 'cherry date', runId: '98s0b1'},
  ],
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
    expect(decide(smoke({deviceID: 'de01', kind: 'device', name: `e2e-${old}-desk`}))).toMatch(/^list: /)
    expect(decide(smoke({deviceID: 'de01', kind: 'device', name: 'e2e-owner-svc-x'}))).toMatch(/^list: /)
  })

  test('a stamped provisioned device of an older run is deleted, a peer device is kept', () => {
    expect(decide(smoke({deviceID: 'de01', kind: 'device', name: `e2e-${old}-prov`}))).toBe('delete')
    expect(decide({account: 'second', deviceID: 'de01', kind: 'device', name: `e2e-${old}-prov`})).toBe('delete')
    expect(decide(smoke({deviceID: 'de02', kind: 'device', name: 'e2e-owner-svc'}))).toMatch(/^kept: peer device/)
    expect(decide(smoke({deviceID: 'de03', kind: 'device', name: `e2e-${ctx.currentRunId}-prov`}))).toMatch(/^kept: made by this run/)
    expect(decide(smoke({kind: 'device', name: `e2e-${old}-prov`}))).toMatch(/^kept: .*device id/)
    expect(decide(smoke({deviceID: 'de01', kind: 'device', name: `e2e-${old}-x-prov`}))).toMatch(/^list: /)
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
    expect(decide(smoke({kind: 'kbfs', name: `/keybase/public/testuser/e2e-${old}-f`}))).toBe('delete')
    expect(decide(smoke({kind: 'kbfs', name: `/keybase/private/testuser,testuser-mac/e2e-${old}-f`}))).toBe('delete')
  })

  test('kbfsRoots for smoke include the public folder and the smoke,second folder', () => {
    expect(kbfsRoots('smoke', ctx)).toEqual([
      '/keybase/private/testuser',
      '/keybase/public/testuser',
      '/keybase/private/testuser,testuser-mac',
      '/keybase/team/testteam',
    ])
    // the pair is sorted, whichever name sorts first
    expect(kbfsRoots('smoke', {team: 't', users: {second: 'aaa', smoke: 'zzz'}})).toContain('/keybase/private/aaa,zzz')
    expect(kbfsRoots('second', ctx)).toEqual([])
  })

  test('kbfs: refuses a path outside the account folders', () => {
    const refused = [
      `/keybase/private/testuser-mac/e2e-${old}-f`, // the other account's folder
      `/keybase/private/testuser-mac,testuser/e2e-${old}-f`, // the pair, unsorted
      `/keybase/private/testuser,testuser-mac,other/e2e-${old}-f`,
      `/keybase/public/testuser-mac/e2e-${old}-f`,
      `/keybase/team/otherteam/e2e-${old}-f`,
      `/keybase/team/testteam.sub/e2e-${old}-f`,
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

describe('messages', () => {
  const msg = (c: Partial<SweepCandidate> & {name: string}): SweepCandidate => ({
    account: 'smoke',
    convID: 'aa02',
    kind: 'message',
    messageID: 7,
    sender: 'testuser',
    ...c,
  })
  test('an own stamped message of an older run in scratch, the DM or self is deleted', () => {
    for (const convID of ['aa01', 'aa02', 'aa03']) expect(decide(msg({convID, name: `e2e-${old}-x hello`}))).toBe('delete')
    expect(decide(msg({account: 'second', convID: 'aa01', name: `e2e-${old}-x`, sender: 'testuser-mac'}))).toBe('delete')
  })
  test('a seeded scratch pad message is kept', () => {
    for (const name of ['e2e-scratch-pad-0001', 'e2e-long-0001', 'e2e-direct-start']) {
      expect(decide(msg({name}))).toMatch(/^kept: unrecognised/)
    }
  })
  test('a message of this run, or a later one, is kept', () => {
    expect(decide(msg({name: `e2e-${ctx.currentRunId}-x`}))).toMatch(/^kept: made by this run/)
    expect(decide(msg({name: 'e2e-98s0a1-x'}))).toMatch(/^kept: .*not before/)
  })
  test("another account's message is dropped", () => {
    expect(decide(msg({name: `e2e-${old}-x`, sender: 'testuser-mac'}))).toBe('dropped')
    expect(decide(msg({account: 'second', convID: 'aa01', name: `e2e-${old}-x`, sender: 'testuser'}))).toBe('dropped')
    expect(decide(msg({name: `e2e-${old}-x`, sender: undefined}))).toBe('dropped')
  })
  test('a message outside scratch/DM/self is dropped', () => {
    expect(decide(msg({convID: 'bb01', name: `e2e-${old}-x`}))).toBe('dropped')
    expect(decide(msg({convID: undefined, name: `e2e-${old}-x`}))).toBe('dropped')
    expect(decide(msg({convID: '', name: `e2e-${old}-x`}))).toBe('dropped')
    // the self conversation is the smoke account's only
    expect(decide(msg({account: 'second', convID: 'aa03', name: `e2e-${old}-x`, sender: 'testuser-mac'}))).toBe('dropped')
    expect(decide(msg({messageID: undefined, name: `e2e-${old}-x`}))).toBe('dropped')
  })
  test('nothing is judged a message target when a conversation id is unknown', () => {
    const noSelf = {...ctx, messageConvs: {...ctx.messageConvs, self: ''}}
    expect(selectSweepTargets([msg({convID: '', name: `e2e-${old}-x`})], noSelf).delete).toEqual([])
  })
})

describe('emoji', () => {
  const emoji = (name: string, team?: string): SweepCandidate => ({account: 'smoke', kind: 'emoji', name, team})
  test('an emoji of an older run in a subteam is deleted, one of this run is kept', () => {
    expect(decide(emoji(`e2e_${old}_smile`, 'testteam.e2esub'))).toBe('delete')
    expect(decide(emoji(`e2e_${old}_smile`, 'testteam'))).toBe('delete')
    expect(decide(emoji(`e2e_${ctx.currentRunId}_smile`, 'testteam.e2esub'))).toMatch(/^kept: made by this run/)
  })
  test('an emoji outside the e2e team and its subteams is dropped', () => {
    for (const team of ['otherteam', 'testteamx', 'otherteam.testteam', 'testteam,testuser', '', undefined]) {
      expect(decide(emoji(`e2e_${old}_smile`, team))).toBe('dropped')
    }
  })
  test('unstamped emoji are dropped or kept', () => {
    expect(decide(emoji('smile', 'testteam'))).toBe('dropped')
    expect(decide(emoji('e2e_smile', 'testteam'))).toMatch(/^kept: unrecognised/)
  })
  test('an emoji goes before the subteam it belongs to, which takes it with it', () => {
    const sub = smoke({kind: 'subteam', name: `testteam.e2e${old}s`})
    const inSub = emoji(`e2e_${old}_smile`, sub.name)
    expect(selectSweepTargets([sub, inSub], ctx).delete).toEqual([inSub, sub])
  })
  test("the listing's #N for an alias two teams share is not part of the alias", () => {
    expect(listedEmojiAlias(`e2e_${old}_smile#2`)).toBe(`e2e_${old}_smile`)
    expect(listedEmojiAlias(`e2e_${old}_smile`)).toBe(`e2e_${old}_smile`)
    expect(listedEmojiAlias('smile#x')).toBe('smile#x')
    expect(decide(emoji(listedEmojiAlias(`e2e_${old}_smile#3`), 'testteam'))).toBe('delete')
  })
  test('a listed #N alias is judged like any other: unstamped, this run, or outside the team', () => {
    expect(decide(emoji(listedEmojiAlias('smile#2'), 'testteam'))).toBe('dropped')
    expect(decide(emoji(listedEmojiAlias(`e2e_${ctx.currentRunId}_x#2`), 'testteam.e2esub'))).toMatch(/^kept: made by this run/)
    expect(decide(emoji(listedEmojiAlias(`e2e_${old}_x#2`), 'otherteam'))).toBe('dropped')
  })
})

describe('team repos', () => {
  const repo = (name: string, team?: string): SweepCandidate => ({account: 'smoke', kind: 'teamRepo', name, team})
  test('a stamped repo of an older run in the e2e team is deleted', () => {
    expect(decide(repo(`e2e-${old}-r`, 'testteam'))).toBe('delete')
    expect(decide(repo(`e2e-${ctx.currentRunId}-r`, 'testteam'))).toMatch(/^kept: made by this run/)
    expect(decide(repo('e2e-vis-repo', 'testteam'))).toMatch(/^kept: unrecognised/)
  })
  test('a repo of any other team, a subteam included, is dropped', () => {
    for (const team of ['otherteam', 'testteam.e2esub', 'testteamx', undefined]) expect(decide(repo(`e2e-${old}-r`, team))).toBe('dropped')
  })
  test('the delete guard passes only an older run\'s stamped repo in the e2e team', () => {
    expect(() => checkDelete(repo(`e2e-${old}-trepo`, 'testteam'), ctx, 'testuser')).not.toThrow()
    expect(() => checkDelete(repo('trepo', 'testteam'), ctx, 'testuser')).toThrow(/no e2e prefix/)
    expect(() => checkDelete(repo('e2e-vis-repo', 'testteam'), ctx, 'testuser')).toThrow(/not run-stamped/)
    expect(() => checkDelete(repo(`e2e-${ctx.currentRunId}-trepo`, 'testteam'), ctx, 'testuser')).toThrow(/made by this run/)
    for (const team of ['otherteam', 'testteam.e2esub', undefined]) {
      expect(() => checkDelete(repo(`e2e-${old}-trepo`, team), ctx, 'testuser')).toThrow(/outside its scope/)
    }
  })
})

describe('paper keys', () => {
  const paper = (deviceID: string | undefined, name: string): SweepCandidate => ({account: 'smoke', deviceID, kind: 'paperKey', name})
  test('a ledger paper key of an older run is deleted', () => {
    expect(decide(paper('dd01', 'apple banana'))).toBe('delete')
  })
  test('a paper key not in the ledger is dropped', () => {
    expect(decide(paper('dd99', 'apple banana'))).toBe('dropped')
    expect(decide(paper(undefined, 'apple banana'))).toBe('dropped')
  })
  test('a ledger paper key whose name changed is kept with a reason', () => {
    expect(decide(paper('dd01', 'apple cherry'))).toMatch(/^kept: .*name/)
  })
  test('a ledger paper key of this run is kept', () => {
    expect(decide(paper('dd02', 'cherry date'))).toMatch(/^kept: made by this run/)
  })
  test('a ledger id on a device that is not a paper key is not revoked as one', () => {
    expect(decide(smoke({deviceID: 'dd01', kind: 'device', name: 'apple banana'}))).toBe('dropped')
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
  test('refuses a listed-only target: a run-stamped device that is not a provisioned one', () => {
    expect(() => checkDelete(smoke({deviceID: 'de01', kind: 'device', name: `e2e-${old}-desk`}), ctx, 'testuser')).toThrow(
      /not revoked/
    )
  })
  test('refuses targets outside their scope', () => {
    expect(() =>
      checkDelete({account: 'smoke', kind: 'emoji', name: `e2e_${old}_x`, team: 'otherteam'}, ctx, 'testuser')
    ).toThrow(/refusing/)
    expect(() =>
      checkDelete({account: 'smoke', kind: 'teamRepo', name: `e2e-${old}-r`, team: 'otherteam'}, ctx, 'testuser')
    ).toThrow(/refusing/)
    expect(() =>
      checkDelete(
        {account: 'smoke', convID: 'bb01', kind: 'message', messageID: 1, name: `e2e-${old}-x`, sender: 'testuser'},
        ctx,
        'testuser'
      )
    ).toThrow(/refusing/)
    expect(() => checkDelete({account: 'smoke', deviceID: 'dd99', kind: 'paperKey', name: 'x y'}, ctx, 'testuser')).toThrow(
      /refusing/
    )
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
