// The git repos one run's git flows make, and the host CLI read-backs they check against. Every write
// here refuses a repo other than this run's own: `e2e-<runid>-repo` of the smoke account, and
// `e2e-<runid>-trepo` of one of this run's subteams of KB_E2E_TEAM (never of KB_E2E_TEAM itself:
// a team repo is deleted before its subteam). A refusal names no repo or team. Framework-free:
// shared by the desktop and iOS flows.
import {loadE2EAccounts} from '../accounts/env.ts'
import {runKeybase} from './peer-service.ts'
import {e2eRunId} from './run-marker.ts'
import {readBack, requireThisRunSubteam} from './teams.ts'

export type RepoRef = {name: string; team?: string}

const gitTimeoutMs = 60_000

export const personalRepo = (): RepoRef => ({name: `e2e-${e2eRunId()}-repo`})
export const teamRepoName = () => `e2e-${e2eRunId()}-trepo`
export const teamRepo = (subteam: string): RepoRef => {
  requireThisRunSubteam(subteam)
  return {name: teamRepoName(), team: subteam}
}

export const requireThisRunRepo = (r: RepoRef) => {
  if (r.team === undefined) {
    if (r.name !== personalRepo().name) throw new Error("refusing to act on a repo that is not this run's personal repo")
    return r
  }
  if (r.name !== teamRepoName()) throw new Error("refusing to act on a repo that is not this run's team repo")
  try {
    requireThisRunSubteam(r.team)
  } catch {
    throw new Error('refusing to act on a team repo outside the subteams this run made')
  }
  return r
}

export const repoUrl = (r: RepoRef) =>
  r.team === undefined ? `keybase://private/${loadE2EAccounts().smokeUser}/${r.name}` : `keybase://team/${r.team}/${r.name}`

const git = async (args: ReadonlyArray<string>) => readBack(async () => runKeybase(['git', ...args], {timeoutMs: gitTimeoutMs}))

// Whether `keybase git list` lists the repo (each line ends with the repo's URL).
export const repoListed = async (r: RepoRef) =>
  (await git(['list'])).split('\n').some(l => l.trim().split(/\s+/).at(-1) === repoUrl(r))

// The section headers `keybase git list` prints above its repos.
const LIST_HEADERS = new Set(['personal repos:', 'team repos:'])

// The clone URLs a `keybase git list` answer holds. The answer must parse: every non-blank line but a
// section header ends with a keybase:// URL, else this throws, so a list that failed or changed shape
// never reads as "gone".
export const listedUrls = (out: string) =>
  out
    .split('\n')
    .map(l => l.trim())
    .filter(l => l !== '' && !LIST_HEADERS.has(l))
    .map(l => {
      const url = l.split(/\s+/).at(-1)!
      if (!url.startsWith('keybase://')) throw new Error('keybase git list: a line does not end with a repo URL')
      return url
    })

// Whether the repo is absent from a list that parsed (see listedUrls). The list may be empty when
// the repo was the account's only one, so no other entry is required.
export const repoGone = async (r: RepoRef) => !listedUrls(await git(['list'])).includes(repoUrl(r))

export type TeamRepoChat = {chatDisabled: boolean; channel?: string}

// The writes, each behind `requireRepo` (the desktop gate's team repo lives in KB_E2E_TEAM itself, so
// it passes its own guard).
export const repoWrites = (requireRepo: (r: RepoRef) => RepoRef) => ({
  // Turns the team repo's chat notifications off, then deletes the repo, when it is still listed;
  // then reads back that it is gone.
  deleteRepoIfPresent: async (r: RepoRef) => {
    const {name, team} = requireRepo(r)
    if (!(await repoListed(r))) return
    if (team !== undefined) await git(['settings', '--disable-chat', name, team])
    await git(['delete', '-f', ...(team === undefined ? [] : ['--team', team]), name])
    if (await repoListed(r)) throw new Error('the repo is still listed after keybase git delete')
  },
  // The repo's chat notification settings, from `keybase git settings`.
  teamRepoChat: async (r: RepoRef): Promise<TeamRepoChat> => {
    const {name, team = ''} = requireRepo(r)
    const out = await git(['settings', name, team])
    const state = /^Chat notifications: (enabled|disabled)$/m.exec(out)?.[1]
    if (!state) throw new Error('keybase git settings: no chat notification state in its answer')
    const channel = /^Chat channel:\s+(\S+)$/m.exec(out)?.[1]
    return {chatDisabled: state === 'disabled', ...(channel === undefined ? {} : {channel})}
  },
})

export const {deleteRepoIfPresent, teamRepoChat} = repoWrites(requireThisRunRepo)
