// A read-only snapshot of the smoke account's state, taken through the `keybase` CLI. It brackets a
// capture set: read before and after, and if the two differ the captures show different data and
// the set is void.
//
// CLI outputs read (all read-only), and what is kept from each:
//   inbox    `chat api -m '{"method":"list"}'` -> {result: {conversations: [{id, channel: {name,
//            members_type, topic_name?}, unread, active_at_ms, ...}], offline, ratelimits}}
//            keeps id, name (team#topic for channels), unread, active_at_ms.
//   teams    `team list-memberships --json` -> {teams: [{team_id, fq_name, role, member_count,
//            is_open_team, ...}]}; `team list-members <team> --json` -> {name, members: {owners,
//            admins, writers, readers, bots, restrictedBots: [{username, role, joinTime, ...}] | null}}
//            keeps team_id, fq_name, role, member_count, is_open_team, and each member's username+role.
//   follows  `list-following --json <user>` -> [{username, uid, link_id}]; `list-followers <user>`
//            -> one username per line (it has no --json). Keeps usernames only.
//   devices  `device list` -> a text table (Name, Type, ID, Created, Last Used; it has no --json).
//            Keeps name, type, id; Created and Last Used are dropped.
//   kbfs     `fs ls -1 --nocolor /keybase/team/<team>` -> one entry name per line.
//   kbfsPrivate  the same for /keybase/private/<smoke user>.
// `git` is left out: nothing here can confirm `keybase git list` is read-only.
import {createHash} from 'crypto'
import {execFile} from 'child_process'
import {e2eAccounts} from '../shared/chat-data.ts'

export type SealField = 'inbox' | 'teams' | 'follows' | 'devices' | 'kbfs' | 'kbfsPrivate'
export type Seal = {
  takenAt: number
  newestMessageMs: number
  fields: Partial<Record<SealField, unknown>>
  hash: string
}

const ALL_FIELDS: ReadonlyArray<SealField> = ['inbox', 'teams', 'follows', 'devices', 'kbfs', 'kbfsPrivate']

type Obj = Record<string, unknown>
const asObj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {})
const asArr = (v: unknown): Array<unknown> => (Array.isArray(v) ? v : [])
const byKey = <T,>(rows: Array<T>, key: (r: T) => string) =>
  [...rows].sort((a, b) => {
    const ka = key(a)
    const kb = key(b)
    return ka < kb ? -1 : ka > kb ? 1 : 0
  })
const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '')
const lines = (s: unknown) =>
  str(s)
    // eslint-disable-next-line no-control-regex
    .replace(/\u001b\[[0-9;]*m/g, '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

const normalizeInbox = (raw: unknown) =>
  byKey(
    asArr(asObj(asObj(raw)['result'])['conversations']).map(c => {
      const conv = asObj(c)
      const channel = asObj(conv['channel'])
      const name = str(channel['name'])
      const topic = channel['topic_name']
      return {
        activeAtMs: conv['active_at_ms'] as number,
        id: conv['id'] as string,
        name: topic ? `${name}#${str(topic)}` : name,
        unread: conv['unread'] as boolean,
      }
    }),
    r => r.id
  )

const normalizeTeams = (raw: unknown) => {
  const {memberships, members} = asObj(raw)
  const memberRows = Object.values(asObj(asObj(members)['members'])).flatMap(group =>
    asArr(group).map(m => ({role: asObj(m)['role'] as number, username: str(asObj(m)['username'])}))
  )
  return {
    members: byKey(memberRows, r => r.username),
    memberships: byKey(
      asArr(asObj(memberships)['teams']).map(t => {
        const team = asObj(t)
        return {
          isOpen: team['is_open_team'] as boolean,
          memberCount: team['member_count'] as number,
          name: str(team['fq_name']),
          role: team['role'] as number,
          teamId: str(team['team_id']),
        }
      }),
      r => r.teamId
    ),
  }
}

const normalizeFollows = (raw: unknown) => {
  const {followers, following} = asObj(raw)
  return {
    followers: lines(followers).sort(),
    following: asArr(following)
      .map(f => str(asObj(f)['username']))
      .sort(),
  }
}

// Columns start where their header does; names contain spaces, so splitting on whitespace is wrong.
export const normalizeDevices = (raw: unknown) => {
  const [header = '', , ...rows] = str(raw).split('\n')
  const typeAt = header.indexOf('Type')
  const idAt = header.indexOf('ID')
  const createdAt = header.indexOf('Created')
  if (typeAt < 0 || idAt < 0 || createdAt < 0) {
    throw new Error(`device list: unrecognised header ${JSON.stringify(header)}`)
  }
  return byKey(
    rows
      .filter(r => r.trim())
      .map(r => ({
        id: r.slice(idAt, createdAt).trim(),
        name: r.slice(0, typeAt).trim(),
        type: r.slice(typeAt, idAt).trim(),
      })),
    r => r.id
  )
}

export const normalize = (field: SealField, raw: unknown): unknown => {
  switch (field) {
    case 'inbox':
      return normalizeInbox(raw)
    case 'teams':
      return normalizeTeams(raw)
    case 'follows':
      return normalizeFollows(raw)
    case 'devices':
      return normalizeDevices(raw)
    case 'kbfs':
    case 'kbfsPrivate':
      return lines(raw).sort()
  }
}

const stable = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(stable)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.entries(v as Obj)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([k, x]) => [k, stable(x)])
        )
      : v

export const hashFields = (fields: object) =>
  createHash('sha256').update(JSON.stringify(stable(fields))).digest('hex')

const show = (v: unknown) => (typeof v === 'object' ? JSON.stringify(v) : String(v as string | number | boolean | undefined))

const walk = (a: unknown, b: unknown, path: string, out: Array<string>) => {
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (i >= a.length) out.push(`${path}[${i}]: added`)
      else if (i >= b.length) out.push(`${path}[${i}]: removed`)
      else walk(a[i], b[i], `${path}[${i}]`, out)
    }
  } else if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()
    for (const k of keys) {
      const p = path ? `${path}.${k}` : k
      if (!(k in a)) out.push(`${p}: added`)
      else if (!(k in b)) out.push(`${p}: removed`)
      else walk((a as Obj)[k], (b as Obj)[k], p, out)
    }
  } else if (show(a) !== show(b) || typeof a !== typeof b) {
    out.push(`${path}: ${show(a)} → ${show(b)}`)
  }
}

export const diffSeals = (a: Seal, b: Seal): Array<string> => {
  const out: Array<string> = []
  walk(a.fields, b.fields, '', out)
  return out
}

const run = async (args: Array<string>, timeoutMs = 30_000) =>
  new Promise<string>((resolve, reject) => {
    const proc = execFile(
      process.env['KB_CLI'] ?? 'keybase',
      args,
      {encoding: 'utf8', killSignal: 'SIGKILL', maxBuffer: 64 * 1024 * 1024, timeout: timeoutMs},
      (err, stdout, stderr) => {
        if (err?.killed) reject(new Error(`seal: keybase ${args.join(' ')}: no answer in ${timeoutMs / 1000}s`))
        else if (err) reject(new Error(`seal: keybase ${args.join(' ')}: ${stderr || err.message}`))
        else resolve(stdout)
      }
    )
    proc.stdin?.end()
  })

const readRaw = async (field: SealField): Promise<unknown> => {
  const {smokeUser, team} = e2eAccounts()
  switch (field) {
    case 'inbox':
      return JSON.parse(await run(['chat', 'api', '-m', '{"method":"list"}'])) as unknown
    case 'teams': {
      const [memberships, members] = await Promise.all([
        run(['team', 'list-memberships', '--json']),
        run(['team', 'list-members', team, '--json']),
      ])
      return {members: JSON.parse(members), memberships: JSON.parse(memberships)} as unknown
    }
    case 'follows': {
      const [following, followers] = await Promise.all([
        run(['list-following', '--json', smokeUser]),
        run(['list-followers', smokeUser]),
      ])
      return {followers, following: JSON.parse(following)} as unknown
    }
    case 'devices':
      return run(['device', 'list'])
    case 'kbfs':
      return run(['fs', 'ls', '-1', '--nocolor', `/keybase/team/${team}`])
    case 'kbfsPrivate':
      return run(['fs', 'ls', '-1', '--nocolor', `/keybase/private/${smokeUser}`])
  }
}

export const readSeal = async (fields: ReadonlyArray<SealField> = ALL_FIELDS): Promise<Seal> => {
  const takenAt = Date.now()
  const raws = await Promise.all(fields.map(async f => [f, normalize(f, await readRaw(f))] as const))
  const out: Seal['fields'] = Object.fromEntries(raws)
  const inbox = out.inbox as Array<{activeAtMs: number}> | undefined
  const newestMessageMs = inbox?.reduce((m, r) => Math.max(m, r.activeAtMs), 0) ?? 0
  return {fields: out, hash: hashFields(out), newestMessageMs, takenAt}
}
