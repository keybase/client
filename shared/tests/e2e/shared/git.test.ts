import {newRunId, stampedTeamName} from '../accounts/run-id'
import {listedUrls, deleteRepoIfPresent, personalRepo, repoWrites, requireThisRunRepo, teamRepo, teamRepoChat, type RepoRef} from './git'

const saved = {...process.env}
const run = newRunId()
const other = newRunId(Date.now() - 3_600_000)
const sub = () => `testteam.${stampedTeamName('abc', run)}`
beforeEach(() => {
  Object.assign(process.env, {KB_E2E_RUN_ID: run, KB_E2E_TEAM: 'testteam', KB_SECOND_USER: 'testuser-mac', KB_SMOKE_USER: 'testuser'})
})
afterEach(() => {
  process.env = {...saved}
})

const refusal = (r: RepoRef) => {
  try {
    requireThisRunRepo(r)
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
  return undefined
}

test("the run's repos: a personal one, and a team one in this run's subteam", () => {
  expect(personalRepo()).toEqual({name: `e2e-${run}-repo`})
  expect(teamRepo(sub())).toEqual({name: `e2e-${run}-trepo`, team: sub()})
  expect(requireThisRunRepo(personalRepo())).toEqual(personalRepo())
  expect(requireThisRunRepo(teamRepo(sub()))).toEqual(teamRepo(sub()))
})

test('a team repo is made only in a subteam of this run', () => {
  for (const team of ['testteam', `testteam.${stampedTeamName('abc', other)}`, 'otherteam']) expect(() => teamRepo(team)).toThrow(/^refusing /)
})

test("refuses another run's repos, any other name, and a team repo in the e2e team itself, naming none", () => {
  for (const r of [
    {name: `e2e-${other}-repo`},
    {name: 'myrepo'},
    {name: `e2e-${run}-trepo`},
    {name: `e2e-${run}-repo`, team: sub()},
    {name: `e2e-${run}-trepo`, team: 'testteam'},
    {name: `e2e-${run}-trepo`, team: `testteam.${stampedTeamName('abc', other)}`},
    {name: `e2e-${other}-trepo`, team: sub()},
    {name: `e2e-${run}-trepo`, team: 'otherteam'},
  ]) {
    const m = refusal(r)
    expect(m).toMatch(/^refusing /)
    for (const n of ['testteam', 'otherteam', 'myrepo', run, other, 'testuser']) expect(m).not.toContain(n)
  }
})

test('the writes refuse before any CLI call', async () => {
  await expect(deleteRepoIfPresent({name: 'myrepo'})).rejects.toThrow(/^refusing /)
  await expect(teamRepoChat({name: `e2e-${run}-trepo`, team: 'testteam'})).rejects.toThrow(/^refusing /)
})

test('repoWrites guards its writes with the guard it is given', async () => {
  const guard = jest.fn((_r: RepoRef): RepoRef => {
    throw new Error('refusing: test guard')
  })
  const w = repoWrites(guard)
  await expect(w.deleteRepoIfPresent(personalRepo())).rejects.toThrow('test guard')
  await expect(w.teamRepoChat(teamRepo(sub()))).rejects.toThrow('test guard')
  expect(guard).toHaveBeenCalledTimes(2)
})

test('a git list answer must parse before a repo can read as gone', () => {
  expect(listedUrls('repo  keybase://private/testuser/a\n\nteam/b keybase://team/t/b\n')).toEqual(['keybase://private/testuser/a', 'keybase://team/t/b'])
  expect(listedUrls('')).toEqual([])
  expect(listedUrls('personal repos:\n  a   keybase://private/testuser/a\nteam repos:\n')).toEqual(['keybase://private/testuser/a'])
  expect(() => listedUrls('Error: not logged in')).toThrow(/does not end with a repo URL/)
})
