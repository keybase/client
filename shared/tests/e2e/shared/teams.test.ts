import {newRunId, stampedTeamName} from '../accounts/run-id'
import {makeSubteamChannel, requireThisRunSubteam} from './teams'

const saved = {...process.env}
const run = newRunId()
const other = newRunId(Date.now() - 3_600_000)
beforeEach(() => {
  Object.assign(process.env, {KB_E2E_RUN_ID: run, KB_E2E_TEAM: 'testteam', KB_SECOND_USER: 'testuser-mac', KB_SMOKE_USER: 'testuser'})
})
afterEach(() => {
  process.env = {...saved}
})

const refusal = (f: () => unknown) => {
  try {
    f()
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
  return undefined
}

describe('requireThisRunSubteam', () => {
  test("passes this run's subteam of the e2e team, as its name part", () => {
    const part = stampedTeamName('abc', run)
    expect(requireThisRunSubteam(`testteam.${part}`)).toBe(part)
  })

  test('refuses the e2e team itself, other runs, other teams, nested and unstamped subteams, naming none', () => {
    for (const name of [
      'testteam',
      'testteam.',
      `testteam.${stampedTeamName('abc', other)}`,
      `otherteam.${stampedTeamName('abc', run)}`,
      `testteamx.${stampedTeamName('abc', run)}`,
      `testteam.${stampedTeamName('abc', run)}.deeper`,
      'testteam.secretsub',
      stampedTeamName('abc', run),
    ]) {
      const m = refusal(() => requireThisRunSubteam(name))
      expect(m).toMatch(/^refusing /)
      for (const n of ['testteam', 'otherteam', 'secretsub', 'deeper', run, other]) expect(m).not.toContain(n)
    }
  })
})

test('makeSubteamChannel refuses another run’s subteam or channel name before any CLI call, naming neither', async () => {
  const sub = `testteam.${stampedTeamName('abc', run)}`
  for (const [team, topic] of [
    [`testteam.${stampedTeamName('abc', other)}`, `e2e-${run}-qqq`],
    ['testteam', `e2e-${run}-qqq`],
    [sub, `e2e-${other}-qqq`],
    [sub, 'general'],
  ] as const) {
    const err = await makeSubteamChannel(team, topic).catch((e: unknown) => e as Error)
    expect(String(err)).toMatch(/refusing /)
    for (const n of ['testteam', 'qqq', 'general', run, other]) expect(String(err)).not.toContain(n)
  }
})
