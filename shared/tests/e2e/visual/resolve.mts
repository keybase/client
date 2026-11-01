// Replaces a Nav's ParamRefs with real values, read-only through the `keybase` CLI:
//   teamname           KB_E2E_TEAM
//   teamFolder         /keybase/team/<KB_E2E_TEAM>
//   privateFolder      /keybase/private/<KB_SMOKE_USER>
//   otherPrivateFolder /keybase/private/<KB_SECOND_USER>, a folder the smoke account can't read
//   username           KB_SMOKE_USER
//   secondUser         KB_SECOND_USER
//   teamID             `team list-memberships --json` -> {teams: [{team_id, fq_name, ...}]}
//   deviceID           `device list` (a text table) -> the ID that sorts first: any one device,
//                      the same one every run
//   conversationIDKey  `chat api -m '{"method":"list"}'` -> {result: {conversations: [{id,
//                      channel: {name, topic_name, members_type}}]}}, matched on team and channel
// Results are cached for the process.
import {execFile} from 'child_process'
import {keybaseBin} from '../shared/keybase-bin.ts'
import {normalizeDevices} from './seal.mts'
import type {Nav, ParamRef, ParamValue} from './tour-types.ts'

export type CliRunner = (args: Array<string>) => Promise<string>

const CLI_TIMEOUT_MS = 30_000
// The service's own fetch from the server timing out, which a second try usually gets past.
const SERVICE_TIMEOUT = 'context deadline exceeded'

// The CLI's error, from its last [ERRO ...] line without the timestamp and sequence number; the
// warnings ahead of it (a CLI and service of different builds, say) are left out.
export const cliError = (stderr: string, fallback: string) => {
  const line = stderr
    .split('\n')
    .filter(l => l.includes('[ERRO '))
    .pop()
  const m = line?.match(/\[ERRO [^\]]*\]\s*(?:\d+\s+)?(.*)$/)
  return m?.[1]?.trim() || stderr.trim().split('\n').pop()?.trim() || fallback
}

const runOnce = async (args: Array<string>) =>
  new Promise<string>((resolve, reject) => {
    const proc = execFile(
      keybaseBin(),
      args,
      {encoding: 'utf8', killSignal: 'SIGKILL', timeout: CLI_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024},
      (err, stdout, stderr) => {
        if (err?.killed) reject(new Error(`keybase ${args[0]}: no answer in ${CLI_TIMEOUT_MS / 1000}s`))
        else if (err) reject(new Error(`keybase ${args[0]}: ${cliError(stderr, err.message)}`))
        else resolve(stdout)
      }
    )
    proc.stdin?.end()
  })

// Every call here only reads, so one the service failed with its own server timeout is run once
// more. Bound: two tries of CLI_TIMEOUT_MS, 60s.
export const runCli: CliRunner = async args => {
  try {
    return await runOnce(args)
  } catch (e) {
    if (!(e instanceof Error) || !e.message.endsWith(SERVICE_TIMEOUT)) throw e
    return runOnce(args)
  }
}

type Obj = Record<string, unknown>
const asObj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {})
const asArr = (v: unknown): Array<unknown> => (Array.isArray(v) ? v : [])

const cache = new Map<string, Promise<string>>()
export const clearResolveCache = () => cache.clear()
const cached = async (key: string, f: () => Promise<string>) => {
  const hit = cache.get(key)
  if (hit) return hit
  const p = f()
  cache.set(key, p)
  p.catch(() => cache.delete(key))
  return p
}

const teamname = () => {
  const t = process.env['KB_E2E_TEAM']
  if (!t) throw new Error('resolving a team param needs KB_E2E_TEAM set in the environment')
  return t
}

const smokeUser = () => {
  const u = process.env['KB_SMOKE_USER']
  if (!u) throw new Error('resolving a username param needs KB_SMOKE_USER set in the environment')
  return u
}

const secondUser = () => {
  const u = process.env['KB_SECOND_USER']
  if (!u) throw new Error('resolving a secondUser param needs KB_SECOND_USER set in the environment')
  return u
}

const inFolder = (folder: string, sub: string | undefined) => (sub ? `${folder}/${sub}` : folder)

const resolveRef = async (ref: ParamRef, run: CliRunner): Promise<string> => {
  switch (ref.ref) {
    case 'teamname':
      return teamname()
    case 'teamFolder':
      return inFolder(`/keybase/team/${teamname()}`, ref.sub)
    case 'privateFolder':
      return inFolder(`/keybase/private/${smokeUser()}`, ref.sub)
    case 'otherPrivateFolder':
      return inFolder(`/keybase/private/${secondUser()}`, ref.sub)
    case 'username':
      return smokeUser()
    case 'secondUser':
      return secondUser()
    case 'teamID': {
      const team = teamname()
      return cached(`teamID:${team}`, async () => {
        const out = asObj(JSON.parse(await run(['team', 'list-memberships', '--json'])))
        const row = asArr(out['teams']).map(asObj).find(t => t['fq_name'] === team)
        const id = row?.['team_id']
        if (typeof id !== 'string') throw new Error(`team list-memberships has no team ${team}`)
        return id
      })
    }
    case 'deviceID':
      return cached('deviceID', async () => {
        const [first] = normalizeDevices(await run(['device', 'list'])).map(d => d.id).sort()
        if (!first) throw new Error('device list has no devices')
        return first
      })
    case 'conversationIDKey': {
      const team = teamname()
      const channel = ref.channel ?? 'general'
      return cached(`conv:${team}#${channel}`, async () => {
        const out = asObj(JSON.parse(await run(['chat', 'api', '-m', JSON.stringify({method: 'list'})])))
        const convs = asArr(asObj(out['result'])['conversations']).map(asObj)
        const hit = convs.find(c => {
          const ch = asObj(c['channel'])
          return ch['name'] === team && ch['topic_name'] === channel
        })
        const id = hit?.['id']
        if (typeof id !== 'string') throw new Error(`chat api list has no conversation ${team}#${channel}`)
        return id
      })
    }
  }
}

export const isRef = (v: unknown): v is ParamRef =>
  !!v && typeof v === 'object' && !Array.isArray(v) && typeof (v as {ref?: unknown}).ref === 'string'

export type Resolved = string | number | boolean | null | Array<Resolved> | {[k: string]: Resolved}

export const resolveValue = async (v: ParamValue, run: CliRunner = runCli): Promise<Resolved> => {
  if (isRef(v)) return resolveRef(v, run)
  if (Array.isArray(v)) return Promise.all(v.map(async x => resolveValue(x as ParamValue, run)))
  if (v && typeof v === 'object') {
    const out: {[k: string]: Resolved} = {}
    for (const [k, x] of Object.entries(v as {[k: string]: ParamValue})) out[k] = await resolveValue(x, run)
    return out
  }
  return v as string | number | boolean | null
}

export type ResolvedNav = {
  tab: string
  append?: {name: string; params?: Record<string, Resolved>}
  thread?: string
}

export async function resolveParams(nav: Nav, run: CliRunner = runCli): Promise<ResolvedNav> {
  const {append, thread} = nav
  let params: Record<string, Resolved> | undefined
  if (append?.params) {
    params = {}
    for (const [k, v] of Object.entries(append.params)) params[k] = await resolveValue(v, run)
  }
  return {
    tab: nav.tab,
    ...(append ? {append: {name: append.name, ...(params ? {params} : {})}} : {}),
    ...(thread ? {thread: await resolveRef(thread, run)} : {}),
  }
}
