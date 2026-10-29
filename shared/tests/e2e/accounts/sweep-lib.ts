// Which leftovers of earlier e2e runs the sweeper may remove. Pure: sweep.mts gathers the
// candidates from the services and does the deletes; everything that decides is here.
//
// Only a name that parses as run-stamped (see run-id.ts), from a run whose start minute ended
// before `before`, is ever deleted. Other `e2e` names (seeded data, flows still on older naming)
// are reported and kept.
import {parseStampedName} from './run-id.ts'

export type SweepAccount = 'smoke' | 'second'
export type SweepKind = 'channel' | 'repo' | 'email' | 'kbfs' | 'subteam' | 'team' | 'device'

// `name` is the exact thing a delete targets: a channel's topic name, a repo name, an email address,
// a KBFS path, a full team name, a device name.
export type SweepCandidate = {
  account: SweepAccount
  kind: SweepKind
  name: string
  // kbfs: set when the entry is a directory
  dir?: {empty: boolean}
  // email: the account's primary address, which cannot be deleted
  primary?: boolean
}

export type SweepContext = {
  // ms; only runs whose start minute ended by then are swept
  before: number
  currentRunId: string
  seededChannels: ReadonlyArray<string>
  // subteam name parts under `team`
  seededSubteams: ReadonlyArray<string>
  team: string
  users: Record<SweepAccount, string>
}

export type SweepNote = {candidate: SweepCandidate; reason: string}
export type SweepSelection = {delete: Array<SweepCandidate>; listOnly: Array<SweepNote>; kept: Array<SweepNote>}

const peerDeviceRe = /^e2e-(?:second|owner)-svc(?:-\d+)?$/
const emailRe = /^([^@\s]+)@[A-Za-z0-9.-]+$/
const safeEntryRe = /^[A-Za-z0-9_.-]+$/

// The KBFS folders swept per account. Peer services run no KBFS, so the second account has none.
export const kbfsRoots = (account: SweepAccount, ctx: Pick<SweepContext, 'team' | 'users'>) =>
  account === 'smoke' ? [`/keybase/private/${ctx.users.smoke}`, `/keybase/team/${ctx.team}`] : []

type Verdict = {to: 'drop'} | {to: 'delete'} | {to: 'listOnly' | 'kept'; reason: string}

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
    case 'channel':
    case 'device':
    case 'repo':
      return c.name
  }
}

const judge = (c: SweepCandidate, ctx: SweepContext): Verdict => {
  const part = stampedPart(c, ctx)
  const isTeam = c.kind === 'team' || c.kind === 'subteam'
  if (part === undefined || !(isTeam ? /^e2e/ : /^e2e-/).test(part)) return {to: 'drop'}

  if (c.kind === 'channel' && ctx.seededChannels.includes(c.name)) return {reason: 'seeded channel', to: 'kept'}
  if (c.kind === 'subteam' && ctx.seededSubteams.includes(part)) return {reason: 'seeded subteam', to: 'kept'}
  if (c.kind === 'device') {
    if (peerDeviceRe.test(c.name)) return {reason: 'peer device', to: 'kept'}
    return {reason: 'devices are listed, not revoked: revokes belong to the flow that provisions them', to: 'listOnly'}
  }
  if (c.kind === 'kbfs') {
    const roots = kbfsRoots(c.account, ctx)
    if (!safeEntryRe.test(part) || !roots.some(r => c.name === `${r}/${part}`)) {
      const where = roots.length ? `an entry directly in ${roots.join(' or ')}` : 'in a folder this account sweeps'
      return {reason: `refused: not ${where}`, to: 'kept'}
    }
  }

  const stamp = parseStampedName(part, isTeam ? 'team' : 'dashed', ctx.before)
  if (!stamp) return {reason: 'unrecognised name (not run-stamped)', to: 'kept'}
  if (stamp.runId === ctx.currentRunId) return {reason: 'made by this run', to: 'kept'}
  if (stamp.startMs + 60_000 > ctx.before) {
    const at = new Date(stamp.startMs).toISOString()
    return {reason: `its run started at ${at}, not before ${new Date(ctx.before).toISOString()}`, to: 'kept'}
  }

  if (c.kind === 'email' && c.primary) return {reason: 'the primary email cannot be deleted', to: 'listOnly'}
  if (c.kind === 'kbfs' && c.dir && !c.dir.empty) return {reason: 'a directory that is not empty', to: 'listOnly'}
  return {to: 'delete'}
}

const depth = (c: SweepCandidate) => c.name.split('.').length

export const selectSweepTargets = (candidates: ReadonlyArray<SweepCandidate>, ctx: SweepContext): SweepSelection => {
  const out: SweepSelection = {delete: [], kept: [], listOnly: []}
  for (const candidate of candidates) {
    const v = judge(candidate, ctx)
    if (v.to === 'delete') out.delete.push(candidate)
    else if (v.to !== 'drop') out[v.to].push({candidate, reason: v.reason})
  }
  // a team with live subteams cannot be deleted: deepest teams go first
  const teamDepth = (c: SweepCandidate) => (c.kind === 'team' || c.kind === 'subteam' ? depth(c) : 0)
  out.delete.sort((a, b) => teamDepth(b) - teamDepth(a))
  return out
}

export const describeCandidate = (c: SweepCandidate) => `${c.account} ${c.kind} ${c.name}`

// Run right before each delete, with the account the acting service says it is signed in as.
export const checkDelete = (c: SweepCandidate, ctx: SweepContext, actingUser: string) => {
  const refuse = (why: string) => new Error(`refusing to delete ${describeCandidate(c)}: ${why}`)
  if (actingUser !== ctx.users[c.account]) {
    throw refuse(`the acting service is signed in as ${actingUser || 'nobody'}, not the ${c.account} account`)
  }
  const v = judge(c, ctx)
  if (v.to === 'drop') throw refuse('no e2e prefix')
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
