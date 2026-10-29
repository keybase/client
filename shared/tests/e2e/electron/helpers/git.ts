// The git repos one run's git flows make, and the CLI read-backs they check against. Every write
// here refuses a repo other than this run's own two: `e2e-<runid>-repo` of the smoke account and
// `e2e-<runid>-trepo` of KB_E2E_TEAM.
import {loadE2EAccounts} from '@/tests/e2e/accounts/env'
import {runKeybase} from '@/tests/e2e/shared/peer-service'
import {e2eRunId} from './fixtures'
import {readBack} from './teams'

export type RepoRef = {name: string; team?: string}

const gitTimeoutMs = 60_000

export const personalRepo = (): RepoRef => ({name: `e2e-${e2eRunId()}-repo`})
export const teamRepo = (): RepoRef => ({name: `e2e-${e2eRunId()}-trepo`, team: loadE2EAccounts().team})

const requireThisRunRepo = (r: RepoRef) => {
  const want = r.team === undefined ? personalRepo() : teamRepo()
  if (r.name !== want.name || r.team !== want.team) {
    throw new Error(`refusing to act on repo ${r.name}: not this run's ${r.team === undefined ? 'personal' : 'e2e team'} repo`)
  }
  return r
}

export const repoUrl = (r: RepoRef) =>
  r.team === undefined ? `keybase://private/${loadE2EAccounts().smokeUser}/${r.name}` : `keybase://team/${r.team}/${r.name}`

const git = async (args: ReadonlyArray<string>) => readBack(async () => runKeybase(['git', ...args], {timeoutMs: gitTimeoutMs}))

// Whether `keybase git list` lists the repo (each line ends with the repo's URL).
export const repoListed = async (r: RepoRef) =>
  (await git(['list'])).split('\n').some(l => l.trim().split(/\s+/).at(-1) === repoUrl(r))

export type TeamRepoChat = {chatDisabled: boolean; channel?: string}

// The repo's chat notification settings, from `keybase git settings`.
export const teamRepoChat = async (r: RepoRef): Promise<TeamRepoChat> => {
  const {name, team = ''} = requireThisRunRepo(r)
  const out = await git(['settings', name, team])
  const state = /^Chat notifications: (enabled|disabled)$/m.exec(out)?.[1]
  if (!state) throw new Error(`keybase git settings: no chat notification state in ${JSON.stringify(out)}`)
  const channel = /^Chat channel:\s+(\S+)$/m.exec(out)?.[1]
  return {chatDisabled: state === 'disabled', ...(channel === undefined ? {} : {channel})}
}

// Turns the team repo's chat notifications off, then deletes the repo, when it is still listed;
// then reads back that it is gone.
export const deleteRepoIfPresent = async (r: RepoRef) => {
  const {name, team} = requireThisRunRepo(r)
  if (!(await repoListed(r))) return
  if (team !== undefined) await git(['settings', '--disable-chat', name, team])
  await git(['delete', '-f', ...(team === undefined ? [] : ['--team', team]), name])
  if (await repoListed(r)) throw new Error(`repo ${name} is still listed after keybase git delete`)
}
