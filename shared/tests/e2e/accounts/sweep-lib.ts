// Which leftovers of earlier e2e runs the sweeper may remove. Pure: sweep.mts gathers the
// candidates from the services and does the deletes; everything that decides is here.
//
// Only a name that parses as run-stamped (see run-id.ts), from a run whose start minute ended
// before `before`, is ever deleted, and only inside its kind's scope:
//   channels, subteams, emoji     KB_E2E_TEAM (emoji: and its subteams)
//   team repos                    KB_E2E_TEAM itself
//   messages                      the account's own, in the scratch channel, the smoke<->second
//                                 conversation or (smoke only) the self conversation
//   KBFS entries                  directly in a folder kbfsRoots names
//   devices                       e2e-<runid>-prov only; peer devices are kept
//   paper keys                    only those the ledger (paper-key-ledger.ts) recorded, by device id
//                                 and unchanged name
// Anything outside its scope is dropped, never judged. Other `e2e` names (seeded data, flows still
// on older naming) are reported and kept.
import {parseStampedName, parseStampedText} from './run-id.ts'
import type {PaperKeyEntry} from './paper-key-ledger.ts'

export type SweepAccount = 'smoke' | 'second'
export type SweepKind =
  | 'channel'
  | 'repo'
  | 'email'
  | 'kbfs'
  | 'subteam'
  | 'team'
  | 'device'
  | 'message'
  | 'emoji'
  | 'teamRepo'
  | 'paperKey'

// `name` is the exact thing a delete targets: a channel's topic name, a repo name, an email address,
// a KBFS path, a full team name, a device name, an emoji alias. For a message it is its body (or an
// attachment's title); the delete targets `convID` and `messageID`.
export type SweepCandidate = {
  account: SweepAccount
  kind: SweepKind
  name: string
  // kbfs: set when the entry is a directory
  dir?: {empty: boolean}
  // email: the account's primary address, which cannot be deleted
  primary?: boolean
  // message: its conversation (hex id), id and sender
  convID?: string
  messageID?: number
  sender?: string
  // device, paperKey
  deviceID?: string
  // emoji, teamRepo: the full name of the team it belongs to
  team?: string
}

export type SweepContext = {
  // ms; only runs whose start minute ended by then are swept
  before: number
  currentRunId: string
  // hex ids of the conversations messages are swept in; '' when the conversation does not exist
  messageConvs: {scratch: string; direct: string; self: string}
  paperKeys: ReadonlyArray<PaperKeyEntry>
  seededChannels: ReadonlyArray<string>
  // subteam name parts under `team`
  seededSubteams: ReadonlyArray<string>
  team: string
  users: Record<SweepAccount, string>
}

export type SweepNote = {candidate: SweepCandidate; reason: string}
export type SweepSelection = {delete: Array<SweepCandidate>; listOnly: Array<SweepNote>; kept: Array<SweepNote>}

const peerDeviceRe = /^e2e-(?:second|owner)-svc(?:-\d+)?$/
// the label a provisioning flow gives the device it makes (e2e-<runid>-prov)
const provDeviceLabel = 'prov'
const emailRe = /^([^@\s]+)@[A-Za-z0-9.-]+$/
const safeEntryRe = /^[A-Za-z0-9_.-]+$/

// The KBFS folders swept per account. Peer services run no KBFS, so the second account has none:
// every file a flow writes lives in one of the smoke account's folders.
export const kbfsRoots = (account: SweepAccount, ctx: Pick<SweepContext, 'team' | 'users'>) =>
  account === 'smoke'
    ? [
        `/keybase/private/${ctx.users.smoke}`,
        `/keybase/public/${ctx.users.smoke}`,
        `/keybase/private/${[ctx.users.smoke, ctx.users.second].sort().join(',')}`,
        `/keybase/team/${ctx.team}`,
      ]
    : []

// The conversations an account's messages are swept in.
const messageConvsFor = (account: SweepAccount, ctx: SweepContext) =>
  (account === 'smoke'
    ? [ctx.messageConvs.scratch, ctx.messageConvs.direct, ctx.messageConvs.self]
    : [ctx.messageConvs.scratch, ctx.messageConvs.direct]
  ).filter(id => !!id)

const inTeamOrSubteam = (team: string | undefined, ctx: SweepContext) =>
  !!team && !!ctx.team && (team === ctx.team || team.startsWith(`${ctx.team}.`))

type Verdict = {to: 'drop'} | {to: 'delete'} | {to: 'listOnly' | 'kept'; reason: string}
type Stamp = {runId: string; startMs: number}

// The part of the name that carries the prefix and stamp, or undefined when this kind of name is
// not ours to judge at all.
const stampedPart = (c: SweepCandidate, ctx: SweepContext): string | undefined => {
  switch (c.kind) {
    case 'email':
      return emailRe.exec(c.name)?.[1]
    case 'kbfs':
      return c.name.slice(c.name.lastIndexOf('/') + 1)
    case 'subteam': {
      const prefix = `${ctx.team}.`
      const part = c.name.startsWith(prefix) ? c.name.slice(prefix.length) : ''
      return part && !part.includes('.') ? part : undefined
    }
    case 'team':
      return c.name.includes('.') ? undefined : c.name
    case 'emoji':
      return inTeamOrSubteam(c.team, ctx) ? c.name : undefined
    case 'teamRepo':
      return c.team && c.team === ctx.team ? c.name : undefined
    case 'message':
      return c.sender === ctx.users[c.account] &&
        Number.isInteger(c.messageID) &&
        (c.messageID ?? 0) > 0 &&
        !!c.convID &&
        messageConvsFor(c.account, ctx).includes(c.convID)
        ? c.name
        : undefined
    case 'paperKey':
      return undefined
    case 'channel':
    case 'device':
    case 'repo':
      return c.name
  }
}

const prefixRe: Record<'dashed' | 'emoji' | 'team', RegExp> = {dashed: /^e2e-/, emoji: /^e2e_/, team: /^e2e/}

const byRun = (stamp: Stamp | undefined, ctx: SweepContext): Verdict | undefined => {
  if (!stamp) return {reason: 'unrecognised name (not run-stamped)', to: 'kept'}
  if (stamp.runId === ctx.currentRunId) return {reason: 'made by this run', to: 'kept'}
  if (stamp.startMs + 60_000 > ctx.before) {
    const at = new Date(stamp.startMs).toISOString()
    return {reason: `its run started at ${at}, not before ${new Date(ctx.before).toISOString()}`, to: 'kept'}
  }
  return undefined
}

// A paper key's name is not ours: only the ledger says a run made it.
const judgePaperKey = (c: SweepCandidate, ctx: SweepContext): Verdict => {
  const entry = c.deviceID ? ctx.paperKeys.find(e => e.deviceID === c.deviceID) : undefined
  if (!entry) return {to: 'drop'}
  if (entry.deviceName !== c.name) return {reason: 'its device name no longer matches the ledger', to: 'kept'}
  const run = parseStampedName(`e2e-${entry.runId}-paper`, 'dashed', ctx.before)
  return byRun(run, ctx) ?? {to: 'delete'}
}

const formOf = (kind: SweepKind) => (kind === 'team' || kind === 'subteam' ? 'team' : kind === 'emoji' ? 'emoji' : 'dashed')

const judge = (c: SweepCandidate, ctx: SweepContext): Verdict => {
  if (c.kind === 'paperKey') return judgePaperKey(c, ctx)
  const part = stampedPart(c, ctx)
  const form = formOf(c.kind)
  if (part === undefined || !prefixRe[form].test(part)) return {to: 'drop'}

  if (c.kind === 'channel' && ctx.seededChannels.includes(c.name)) return {reason: 'seeded channel', to: 'kept'}
  if (c.kind === 'subteam' && ctx.seededSubteams.includes(part)) return {reason: 'seeded subteam', to: 'kept'}
  if (c.kind === 'device') {
    if (peerDeviceRe.test(c.name)) return {reason: 'peer device', to: 'kept'}
    const run = parseStampedName(c.name, 'dashed', ctx.before)
    if (!run || c.name !== `e2e-${run.runId}-${provDeviceLabel}`) {
      return {reason: `not revoked: only e2e-<runid>-${provDeviceLabel} devices are`, to: 'listOnly'}
    }
    if (!c.deviceID) return {reason: 'no device id listed for it', to: 'kept'}
  }
  if (c.kind === 'kbfs') {
    const roots = kbfsRoots(c.account, ctx)
    if (!safeEntryRe.test(part) || !roots.some(r => c.name === `${r}/${part}`)) {
      const where = roots.length ? `an entry directly in ${roots.join(' or ')}` : 'in a folder this account sweeps'
      return {reason: `refused: not ${where}`, to: 'kept'}
    }
  }

  const stamp = c.kind === 'message' ? parseStampedText(part, ctx.before) : parseStampedName(part, form, ctx.before)
  const notOlder = byRun(stamp, ctx)
  if (notOlder) return notOlder

  if (c.kind === 'email' && c.primary) return {reason: 'the primary email cannot be deleted', to: 'listOnly'}
  if (c.kind === 'kbfs' && c.dir && !c.dir.empty) return {reason: 'a directory that is not empty', to: 'listOnly'}
  return {to: 'delete'}
}

const depth = (c: SweepCandidate) => c.name.split('.').length
// deletes sort by this, highest first: above the depth of any team name
const emojiOrder = 1_000

// The service lists an alias that more than one of the account's teams use with `#<n>` after it;
// an alias cannot hold '#', so that suffix is the listing's, not the emoji's.
export const listedEmojiAlias = (listed: string) => listed.replace(/#\d+$/, '')

export const selectSweepTargets = (candidates: ReadonlyArray<SweepCandidate>, ctx: SweepContext): SweepSelection => {
  const out: SweepSelection = {delete: [], kept: [], listOnly: []}
  for (const candidate of candidates) {
    const v = judge(candidate, ctx)
    if (v.to === 'delete') out.delete.push(candidate)
    else if (v.to !== 'drop') out[v.to].push({candidate, reason: v.reason})
  }
  // a team with live subteams cannot be deleted: deepest teams go first. An emoji goes before every
  // team: its delete goes through its team, which a team delete before it would have removed.
  const order = (c: SweepCandidate) => (c.kind === 'emoji' ? emojiOrder : c.kind === 'team' || c.kind === 'subteam' ? depth(c) : 0)
  out.delete.sort((a, b) => order(b) - order(a))
  return out
}

// A message shows its first word and id; a paper key only its device id (its name is two of its
// words).
export const describeCandidate = (c: SweepCandidate) => {
  switch (c.kind) {
    case 'message':
      return `${c.account} message ${c.messageID ?? '?'} ${c.name.split(/\s/, 1)[0] ?? ''}`
    case 'paperKey':
      return `${c.account} paperKey ${c.deviceID ?? '?'}`
    case 'emoji':
    case 'teamRepo':
      return `${c.account} ${c.kind} ${c.team ?? '?'}/${c.name}`
    default:
      return `${c.account} ${c.kind} ${c.name}`
  }
}

// What tells two candidates apart: the same name can be two messages, or two devices.
export const candidateKey = (c: SweepCandidate) =>
  [c.account, c.kind, c.name, c.team ?? '', c.convID ?? '', c.messageID ?? '', c.deviceID ?? ''].join('\u0000')

// Run right before each delete, with the account the acting service says it is signed in as.
export const checkDelete = (c: SweepCandidate, ctx: SweepContext, actingUser: string) => {
  const refuse = (why: string) => new Error(`refusing to delete ${describeCandidate(c)}: ${why}`)
  if (actingUser !== ctx.users[c.account]) {
    throw refuse(`the acting service is signed in as ${actingUser || 'nobody'}, not the ${c.account} account`)
  }
  const v = judge(c, ctx)
  if (v.to === 'drop') throw refuse('no e2e prefix, or outside its scope')
  if (v.to !== 'delete') throw refuse(v.reason)
}

// `keybase fs ls -w` (its windows-style listing, tab-separated, so a name may hold spaces) lines:
// `<time>\t<DIR>\t\t<name>` for a directory (`<SYM>` for a link), `<time>\t<size>\t<name>` for a file.
export const parseKbfsLs = (out: string) =>
  out
    .split('\n')
    .filter(l => l.trim())
    .map(l => {
      const fields = l.split('\t')
      return {isDir: fields[1] === '<DIR>', name: fields[fields.length - 1] ?? ''}
    })
    .filter(e => e.name !== '.' && e.name !== '..')

// Output names the test accounts and team only by role.
export const maskAccounts = (s: string, ctx: Pick<SweepContext, 'team' | 'users'>) =>
  [
    [ctx.team, '<team>'],
    [ctx.users.second, '<second>'],
    [ctx.users.smoke, '<smoke>'],
  ]
    .filter(([name]) => !!name)
    .sort((a, b) => (b[0]?.length ?? 0) - (a[0]?.length ?? 0))
    .reduce((acc, [name, role]) => acc.split(name ?? '').join(role), s)
