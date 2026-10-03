// Replaces a Nav's ParamRefs with real values, read-only through the `keybase` CLI:
//   teamname           KB_E2E_TEAM
//   teamID             `team list-memberships --json` -> {teams: [{team_id, fq_name, ...}]}
//   conversationIDKey  `chat api -m '{"method":"list"}'` -> {result: {conversations: [{id,
//                      channel: {name, topic_name, members_type}}]}}, matched on team and channel
// Results are cached for the process.
import {execFile} from 'child_process'
import type {Nav, ParamRef} from './tour-types.ts'

export type CliRunner = (args: Array<string>) => Promise<string>

const CLI_TIMEOUT_MS = 30_000

export const runCli: CliRunner = async args =>
  new Promise<string>((resolve, reject) => {
    const proc = execFile(
      process.env['KB_CLI'] ?? 'keybase',
      args,
      {encoding: 'utf8', killSignal: 'SIGKILL', timeout: CLI_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024},
      (err, stdout, stderr) => {
        if (err?.killed) reject(new Error(`keybase ${args[0]}: no answer in ${CLI_TIMEOUT_MS / 1000}s`))
        else if (err) reject(new Error(`keybase ${args[0]}: ${stderr || err.message}`))
        else resolve(stdout)
      }
    )
    proc.stdin?.end()
  })

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

const resolveRef = async (ref: ParamRef, run: CliRunner): Promise<string> => {
  switch (ref.ref) {
    case 'teamname':
      return teamname()
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

const isRef = (v: unknown): v is ParamRef => !!v && typeof v === 'object' && 'ref' in v

export async function resolveParams(nav: Nav, run: CliRunner = runCli): Promise<Nav> {
  const append = nav.append
  if (!append?.params) return nav
  const params: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(append.params)) {
    params[k] = isRef(v) ? await resolveRef(v, run) : v
  }
  return {...nav, append: {...append, params}}
}
