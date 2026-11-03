import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {newRunId} from '../accounts/run-id'
import {leaf, newWorkFolder, requireOwnPath, stampedEntry, waitForKbfs} from './files'

const saved = {...process.env}
const run = newRunId()
const other = newRunId(Date.now() - 3_600_000)
let dir = ''
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'files-'))
  Object.assign(process.env, {KB_E2E_RUN_ID: run, KB_E2E_TEAM: 'testteam', KB_SECOND_USER: 'testuser-mac', KB_SMOKE_USER: 'testuser'})
})
afterEach(() => {
  process.env = {...saved}
  fs.rmSync(dir, {force: true, recursive: true})
})

const refusal = (p: string) => {
  try {
    requireOwnPath(p)
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
  return undefined
}

describe('requireOwnPath', () => {
  test('passes an entry this run made in the smoke folder or the smoke+second folder, and what is inside it', () => {
    for (const p of [
      `/keybase/private/testuser/e2e-${run}-files-ab12`,
      `/keybase/private/testuser/e2e-${run}-files-ab12/sub/a.txt`,
      `/keybase/private/testuser,testuser-mac/e2e-${run}-sync`,
    ]) {
      expect(requireOwnPath(p)).toBe(p)
    }
    expect(requireOwnPath(newWorkFolder())).toMatch(new RegExp(`^/keybase/private/testuser/e2e-${run}-files-[0-9a-f]{4}$`))
  })

  test("refuses other users' folders, the folders themselves, other runs, unstamped entries and unplain paths", () => {
    for (const p of [
      `/keybase/private/someone/e2e-${run}-x`,
      `/keybase/private/testuserx/e2e-${run}-x`,
      `/keybase/private/testuser,someone/e2e-${run}-x`,
      `/keybase/public/testuser/e2e-${run}-x`,
      `/keybase/team/testteam/e2e-${run}-x`,
      '/keybase/private/testuser',
      '/keybase/private/testuser/',
      `/keybase/private/testuser/e2e-${other}-x`,
      '/keybase/private/testuser/notes',
      `/keybase/private/testuser/e2e-${run}-x/../secret`,
      `/keybase/private/testuser/e2e-${run}-x/*`,
      `/keybase/private/testuser/e2e-${run}-x/a b`,
      // a trailing slash after the entry: an empty name part
      `/keybase/private/testuser/e2e-${run}-x/`,
      `/keybase/private/testuser/e2e-${run}-x//a`,
      // the account name in another case is not the account's folder
      `/keybase/private/TestUser/e2e-${run}-x`,
      `/keybase/private/TESTUSER,testuser-mac/e2e-${run}-x`,
    ]) {
      expect(refusal(p)).toMatch(/^refusing /)
    }
  })

  test('a refusal names no account, folder or entry', () => {
    for (const p of [`/keybase/private/someone/e2e-${run}-x`, '/keybase/private/testuser/notes', `/keybase/private/testuser/e2e-${run}-x/a b`]) {
      const m = refusal(p) ?? ''
      for (const name of ['testuser', 'someone', 'notes', 'e2e-', 'keybase']) expect(m).not.toContain(name)
    }
  })
})

test('stampedEntry and leaf', () => {
  expect(stampedEntry('x')).toBe(`e2e-${run}-x`)
  expect(leaf('/keybase/private/testuser/e2e-r-x')).toBe('e2e-r-x')
})

// A stand-in `keybase` whose `fs ls -w` prints the listing in the file `listing` (re-read each call).
const fakeKeybase = (listing: string) => `#!/bin/sh
shift
[ "$1 $2" = "fs ls" ] || { echo "unexpected: $*" >&2; exit 3; }
cat ${JSON.stringify(listing)}
`

describe('waitForKbfs', () => {
  const folder = () => `/keybase/private/testuser/e2e-${run}-files-ab12`
  const listing = () => path.join(dir, 'listing')
  beforeEach(() => {
    const bin = path.join(dir, 'keybase')
    fs.writeFileSync(bin, fakeKeybase(listing()), {mode: 0o700})
    process.env['KB_CLI'] = bin
  })

  test('waits until the host lists the entry as asked', async () => {
    fs.writeFileSync(listing(), '')
    setTimeout(() => fs.writeFileSync(listing(), '2026-10-30 12:00\t<DIR>\t\tnew\n2026-10-30 12:00\t12\ta.txt\n'), 300)
    await expect(waitForKbfs(`${folder()}/new`, 'dir', 5_000)).resolves.toEqual({isDir: true, name: 'new', size: 0})
    await expect(waitForKbfs(`${folder()}/a.txt`, {size: 12}, 5_000)).resolves.toEqual({isDir: false, name: 'a.txt', size: 12})
    await expect(waitForKbfs(`${folder()}/gone`, 'absent', 5_000)).resolves.toBeUndefined()
  }, 20_000)

  test('times out naming no entry, and refuses a path that is not this run’s', async () => {
    fs.writeFileSync(listing(), '2026-10-30 12:00\t12\ta.txt\n')
    const err = await waitForKbfs(`${folder()}/a.txt`, 'dir', 1_500).then(
      () => '',
      (e: unknown) => (e instanceof Error ? e.message : 'not an Error')
    )
    expect(err).toMatch(/timed out/)
    expect(err).not.toMatch(/testuser|a\.txt|e2e-/)
    await expect(waitForKbfs('/keybase/private/someone/e2e-x', 'file', 1_000)).rejects.toThrow(/^refusing /)
  }, 20_000)

  test('a listing that fails is retried, and its error names no account, folder or entry', async () => {
    const err = await waitForKbfs(`${folder()}/a.txt`, 'file', 1_000).then(
      () => '',
      (e: unknown) => (e instanceof Error ? e.message : 'not an Error')
    )
    expect(err).toMatch(/timed out.*No such file/)
    expect(err).not.toMatch(/testuser|a\.txt|e2e-/)
  }, 20_000)
})
