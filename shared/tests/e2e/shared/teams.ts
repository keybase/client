// Subteams of the e2e team that one run's team flows make, change and delete, and the host read-backs
// those flows check against. Every write here refuses a team that is not a subteam of KB_E2E_TEAM
// named with this run's id (accounts/run-id.ts), so nothing outside that scope is ever changed, and
// a refusal names no team. Framework-free: shared by the desktop and iOS flows.
import {randomBytes} from 'crypto'
import escapeRegExp from 'lodash/escapeRegExp'
import {loadE2EAccounts} from '../accounts/env.ts'
import {parseStampedName, stampedTeamName} from '../accounts/run-id.ts'
import {createThrowawaySubteam, deleteThrowawaySubteam, retryTransient} from './chat-data.ts'
import {convIDBytes} from './conv-id.ts'
import {waitFor} from './deadline.ts'
import {mainRpc} from './main-rpc.ts'
import {runKeybase} from './peer-service.ts'
import {parsePicLookup} from './profile-parse.ts'
import {e2eRunId} from './run-marker.ts'

// A deleted team's name is never free again, so each attempt in a run takes its own: `prefix`
// (up to 3 characters) and 4 random hex characters, the 7 a stamped team name allows.
const freshLabel = (prefix: string) => `${prefix}${randomBytes(2).toString('hex')}`
export const freshSubteamPart = (prefix: string) => stampedTeamName(freshLabel(prefix), e2eRunId())

// The name part under KB_E2E_TEAM of a subteam this run made; throws for any other team, the e2e
// team itself included.
export const requireThisRunSubteam = (name: string) => {
  const {team} = loadE2EAccounts()
  const part = name.startsWith(`${team}.`) ? name.slice(team.length + 1) : ''
  if (!part || part.includes('.') || parseStampedName(part, 'team')?.runId !== e2eRunId()) {
    throw new Error('refusing to act on a team that is not a subteam of the e2e team made by this run')
  }
  return part
}

// A read-back through the main service or the CLI, again when the server refused it in passing.
export const readBack = async <R,>(f: () => Promise<R>): Promise<R> => (await retryTransient(f)) as R

// One main-service read-back (mainRpc), through readBack.
export const mainRead = async <R,>(method: string, arg: object) => readBack(async () => mainRpc<R>(method, arg))

// What the service answers for `name` when it names no team the account can load: a deleted team's
// name answers like one never made ("not a member", code 2623; the server's team-not-found, code
// 2614, which the service rewrites as `Team "<name>" does not exist`) or as tombstoned, and a
// renamed team's old name as a bad name (the team it resolved to is now called something else).
// Each is anchored to its own wording, so another error that happens to say "not found" is not
// read as the team being gone.
const goneRe = (name: string) =>
  new RegExp(
    `\\(code 26(?:14|23)\\)|\\btombstoned\\b|\\bTeam "${escapeRegExp(name)}"(?: \\(public\\))? does not exist\\b|\\bbad name error\\b`,
    'i'
  )

// Whether a subteam exists, by its exact name: the service resolves the name to an id, or says it
// names no team. (A listing of the parent's subteams fails outright for a while after any subteam
// of it is deleted.)
export const subteamExists = async (name: string) => {
  try {
    await mainRead<string>('keybase.1.teams.getTeamID', {teamName: name})
    return true
  } catch (e) {
    if (goneRe(name).test(e instanceof Error ? e.message : String(e))) return false
    throw e
  }
}

// Deletes one of this run's subteams through the CLI when it is still there, then waits until the
// service no longer lists it. Bound: the first existence check (one getTeamID), the delete (90s), then
// 30s of checks plus the one under way at its end.
export const deleteSubteamIfPresent = async (name: string) => {
  requireThisRunSubteam(name)
  if (await subteamExists(name)) await deleteThrowawaySubteam(name)
  await waitFor('the subteam to be gone after its delete', async () => ((await subteamExists(name)) ? undefined : true), {
    timeout: 30_000,
  })
}

// A subteam of the e2e team for one test, made through the CLI with the smoke account as admin.
// `prefix` is up to 3 characters.
export const makeSubteam = async (prefix: string) => createThrowawaySubteam(freshLabel(prefix))

export type TeamRoleName = 'owner' | 'admin' | 'writer' | 'reader' | 'bot' | 'restrictedbot'
type ListMembers = {
  members: Partial<Record<'owners' | 'admins' | 'writers' | 'readers' | 'bots' | 'restrictedBots', Array<{username: string}> | null>>
  annotatedActiveInvites?: Record<string, {invite: {id: string; name: string; type: {c: number; unknown?: string; sbs?: string}}; displayName?: string}> | null
}
const listMembers = async (name: string) =>
  JSON.parse(await readBack(async () => runKeybase(['team', 'list-members', name, '-j'], {timeoutMs: 60_000}))) as ListMembers

// Each member's role in a team, read through the CLI.
export const memberRoles = async (name: string): Promise<Record<string, TeamRoleName>> => {
  const {members} = await listMembers(name)
  const roles: Record<string, TeamRoleName> = {}
  const of = {admins: 'admin', bots: 'bot', owners: 'owner', readers: 'reader', restrictedBots: 'restrictedbot', writers: 'writer'} as const
  for (const [key, role] of Object.entries(of)) {
    for (const m of members[key as keyof typeof of] ?? []) roles[m.username] = role
  }
  return roles
}

// The names a team's pending invites are for (an email address, a phone number, a username).
export const inviteNames = async (name: string) =>
  Object.values((await listMembers(name)).annotatedActiveInvites ?? {}).map(i => i.displayName || i.invite.name)

// A subteam of this run's avatar url (square_192) as the server has it, '' when it has none.
export const subteamAvatarUrl = async (name: string) => {
  requireThisRunSubteam(name)
  const args = ['apicall', '-m', 'GET', 'image/team_avatar_lookups', '-a', `team_names=${name}`, '-a', 'formats=square_192']
  return parsePicLookup(await readBack(async () => runKeybase(args, {timeoutMs: 30_000})))
}

export const teamID = async (name: string) => readBack(async () => mainRpc<string>('keybase.1.teams.getTeamID', {teamName: name}))

// One of a team's conversations as the main service localizes it.
export type ConvInfo = {headline: string; topicName: string}
export const conversationInfo = async (convID: string): Promise<ConvInfo> => {
  const res = await readBack(async () =>
    mainRpc<{conversations?: Array<{info: ConvInfo}> | null}>('chat.1.local.getInboxAndUnboxLocal', {
      identifyBehavior: 6, // chatSkip
      query: {computeActiveList: false, convIDs: [convIDBytes(convID)], readOnly: true, unreadOnly: false},
    })
  )
  const conv = res.conversations?.[0]
  if (!conv) throw new Error('the main service reads no such conversation')
  return conv.info
}

// One `keybase chat api` call through the CLI, as setup or a read-back.
export const runChatApi = async <R,>(method: string, options: object): Promise<R> => {
  const out = await readBack(async () => runKeybase(['chat', 'api', '-m', JSON.stringify({method, params: {options}})], {timeoutMs: 60_000}))
  const res = JSON.parse(out) as {error?: {message: string}; result?: R}
  if (res.error) throw new Error(`chat api ${method}: ${res.error.message}`)
  return res.result as R
}

// A team's channels by topic name, read through the CLI.
export const teamChannels = async (name: string) => {
  const res = await runChatApi<{conversations?: Array<{channel: {topic_name?: string}; id: string}> | null}>('listconvsonname', {
    members_type: 'team',
    name,
    topic_type: 'CHAT',
  })
  return new Map((res.conversations ?? []).map(c => [c.channel.topic_name ?? '', c.id]))
}

// Makes a channel in one of this run's subteams through the CLI, and returns its conversation id.
export const makeSubteamChannel = async (subteam: string, topicName: string) => {
  requireThisRunSubteam(subteam)
  if (parseStampedName(topicName, 'dashed')?.runId !== e2eRunId()) throw new Error('refusing a channel name that is not one of this run')
  await retryTransient(async () => runKeybase(['chat', 'create-channel', subteam, topicName], {timeoutMs: 60_000}), /already exists/i)
  const id = (await teamChannels(subteam)).get(topicName)
  if (!id) throw new Error('the channel was not created')
  return id
}

// A team channel's members, by username, read through the CLI.
export const channelMembers = async (team: string, topicName: string) => {
  type M = Partial<Record<'owners' | 'admins' | 'writers' | 'readers', Array<{username: string}> | null>>
  const r = await runChatApi<M>('listmembers', {channel: {members_type: 'team', name: team, topic_name: topicName}})
  return [...(r.owners ?? []), ...(r.admins ?? []), ...(r.writers ?? []), ...(r.readers ?? [])].map(m => m.username)
}

// Adds a user to one of this run's subteams through the CLI, as setup.
export const addToSubteamFromCli = async (subteam: string, username: string, role: 'reader' | 'writer') => {
  requireThisRunSubteam(subteam)
  await retryTransient(
    async () => runKeybase(['team', 'add-member', subteam, `--user=${username}`, `--role=${role}`, '--skip-chat-message'], {timeoutMs: 60_000}),
    /already a member/i
  )
}
