// The accounts the e2e runs use, from ~/.config/keybase-e2e/env (mode 600, in a mode 700 dir) with the process
// environment taking precedence. The file holds `export K='v'` lines; they are parsed here, never
// handed to a shell, so a value is only ever data.
//
// Peers are extra `keybase --home <dir> service` processes signed in as the other accounts:
//   second  KB_SECOND_USER, the account the app talks to (or runs as, for owner-only flows)
//   owner   KB_SMOKE_USER on its own device, for team-owner actions while the app runs as second
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

export type PeerRole = 'second' | 'owner'
export const peerRoles: ReadonlyArray<PeerRole> = ['second', 'owner']

export type PeerAccount = {home: string; user: string; paperKey: string}
export type E2EEnv = {
  smokeUser: string
  secondUser: string
  team: string
  peers: Record<PeerRole, PeerAccount>
  // KB_E2E_SERVICE_LOG: the main service's log, when not the default
  serviceLog?: string
  // KB_SECOND_PASSWORD: the second account's password, which the harness sets (second-password.mts).
  // Never printed: redactSecrets does not catch it, so no output may include it at all.
  secondPassword?: string
  // KB_SECOND_PASSWORD_NEXT is set: a password change stopped part way, so the server holds either
  // it or KB_SECOND_PASSWORD (only whether it is set is kept here, never the value)
  secondPasswordChangePending?: boolean
}

export const e2eConfigDir = () => path.join(os.homedir(), '.config', 'keybase-e2e')
export const defaultEnvPath = () => path.join(e2eConfigDir(), 'env')
export const defaultPeerHome = (role: PeerRole) => path.join(e2eConfigDir(), 'homes', role)
// Where a run's provisioning flow keeps the device it makes (e2e-<runid>-prov); the sweeper
// retires a leftover one from here.
export const provisionHomeFor = (runId: string) => path.join(e2eConfigDir(), 'homes', `prov-${runId}`)

export const homeVar = (role: PeerRole) => `KB_${role.toUpperCase()}_HOME`
export const paperKeyVar = (role: PeerRole) => `KB_${role.toUpperCase()}_PAPERKEY`

export const envVarNames = [
  'KB_SMOKE_USER',
  'KB_SECOND_USER',
  'KB_E2E_TEAM',
  homeVar('second'),
  paperKeyVar('second'),
  homeVar('owner'),
  paperKeyVar('owner'),
] as const

const lineRe = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/

const parseValue = (raw: string) => {
  const s = raw.trimStart()
  if (s.startsWith("'")) {
    const end = s.indexOf("'", 1)
    return end < 0 ? s.slice(1) : s.slice(1, end)
  }
  if (s.startsWith('"')) {
    let out = ''
    for (let i = 1; i < s.length; i++) {
      const c = s[i] ?? ''
      if (c === '"') break
      if (c === '\\' && i + 1 < s.length) {
        out += s[++i] ?? ''
        continue
      }
      out += c
    }
    return out
  }
  return s.split(/[\s#]/, 1)[0] ?? ''
}

export const parseEnvText = (text: string): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const line of text.split('\n')) {
    if (/^\s*#/.test(line)) continue
    const m = lineRe.exec(line)
    if (m?.[1] !== undefined && m[2] !== undefined) out[m[1]] = parseValue(m[2])
  }
  return out
}

const checkMode = (file: string) => {
  const mode = fs.statSync(file).mode & 0o777
  if (mode !== 0o600) {
    throw new Error(`${file} is mode ${mode.toString(8)}; it holds paper keys, so it must be 600 (chmod 600 ${file})`)
  }
  const dir = path.dirname(file)
  const dirMode = fs.statSync(dir).mode & 0o777
  if (dirMode !== 0o700) {
    throw new Error(`${dir} is mode ${dirMode.toString(8)}; it holds the env file and peer homes, so it must be 700 (chmod 700 ${dir})`)
  }
}

// The file's vars, or {} when there is no file. Refuses a file anyone but the owner can read.
export const readEnvFile = (file: string): Record<string, string> => {
  if (!fs.existsSync(file)) return {}
  checkMode(file)
  return parseEnvText(fs.readFileSync(file, 'utf8'))
}

// `names` from the environment, else the file, and which of them neither has.
const mergeVars = (names: ReadonlyArray<string>, file: string, env: NodeJS.ProcessEnv) => {
  const fromFile = readEnvFile(file)
  const vars: Record<string, string> = {}
  for (const name of names) {
    const v = env[name] || fromFile[name]
    if (v) vars[name] = v
  }
  return {get: (n: string) => vars[n] ?? '', missing: names.filter(n => !vars[n])}
}

const missingError = (missing: ReadonlyArray<string>, file: string) =>
  new Error(`e2e env is missing ${missing.join(', ')} (from ${file} or the environment; yarn test:e2e:accounts:setup fills in the peers)`)

export type E2EAccounts = Pick<E2EEnv, 'smokeUser' | 'secondUser' | 'team'>

// Just the account names, for code that needs no peer.
export const loadE2EAccounts = (file = defaultEnvPath(), env: NodeJS.ProcessEnv = process.env): E2EAccounts => {
  const {get, missing} = mergeVars(['KB_SMOKE_USER', 'KB_SECOND_USER', 'KB_E2E_TEAM'], file, env)
  if (missing.length) throw missingError(missing, file)
  return {secondUser: get('KB_SECOND_USER'), smokeUser: get('KB_SMOKE_USER'), team: get('KB_E2E_TEAM')}
}

export const loadE2EEnv = (file = defaultEnvPath(), env: NodeJS.ProcessEnv = process.env): E2EEnv => {
  const optional = ['KB_E2E_SERVICE_LOG', 'KB_SECOND_PASSWORD', 'KB_SECOND_PASSWORD_NEXT']
  const {get, missing} = mergeVars([...envVarNames, ...optional], file, env)
  const required = missing.filter(n => !optional.includes(n))
  if (required.length) throw missingError(required, file)
  const smokeUser = get('KB_SMOKE_USER')
  const secondUser = get('KB_SECOND_USER')
  const serviceLog = get('KB_E2E_SERVICE_LOG')
  const secondPassword = get('KB_SECOND_PASSWORD')
  return {
    peers: {
      owner: {home: get(homeVar('owner')), paperKey: get(paperKeyVar('owner')), user: smokeUser},
      second: {home: get(homeVar('second')), paperKey: get(paperKeyVar('second')), user: secondUser},
    },
    ...(secondPassword ? {secondPassword} : {}),
    ...(get('KB_SECOND_PASSWORD_NEXT') ? {secondPasswordChangePending: true} : {}),
    secondUser,
    ...(serviceLog ? {serviceLog} : {}),
    smokeUser,
    team: get('KB_E2E_TEAM'),
  }
}

export const secondPasswordCommand = 'yarn test:e2e:accounts:second-password'

// Throws while KB_SECOND_PASSWORD_NEXT is set: which of the two values the server holds needs the owner.
export const refuseWhileSecondPasswordChangePending = (env: Pick<E2EEnv, 'secondPasswordChangePending'>) => {
  if (env.secondPasswordChangePending) {
    throw new Error(
      'e2e env has KB_SECOND_PASSWORD_NEXT: a password change stopped part way and the server holds either it or KB_SECOND_PASSWORD; the owner has to check which and remove KB_SECOND_PASSWORD_NEXT before any password flow runs'
    )
  }
}

// The second account's password, for the flows that type it. Refuses while a password change that
// stopped part way is unresolved: which of the two the server holds needs the owner.
export const requireSecondPassword = (env: E2EEnv) => {
  refuseWhileSecondPasswordChangePending(env)
  if (!env.secondPassword) throw new Error(`e2e env is missing KB_SECOND_PASSWORD (${secondPasswordCommand} sets it)`)
  return env.secondPassword
}

// What a child process of a run is handed, so code that reads only the environment sees the same
// accounts: names and the service log, never a paper key.
export const childEnvVars = (env: E2EEnv): Record<string, string> => ({
  KB_E2E_TEAM: env.team,
  KB_SECOND_USER: env.secondUser,
  KB_SMOKE_USER: env.smokeUser,
  ...(env.serviceLog ? {KB_E2E_SERVICE_LOG: env.serviceLog} : {}),
})

// Rewrites `name` lines in place (or appends them; a null value removes the line), keeping the file
// mode 600. The write goes through a temp file and a rename, so an interrupted run never leaves a
// half-written env file.
export const setEnvVars = (file: string, updates: Record<string, string | null>) => {
  for (const [k, v] of Object.entries(updates)) {
    if (v !== null && (v.includes("'") || v.includes('\n'))) throw new Error(`refusing to write ${k}: its value has a quote or newline`)
  }
  const text = fs.existsSync(file) ? (checkMode(file), fs.readFileSync(file, 'utf8')) : ''
  const lines = text === '' ? [] : text.replace(/\n$/, '').split('\n')
  const pending = new Map(Object.entries(updates))
  const out = lines.flatMap(line => {
    const name = lineRe.exec(line)?.[1]
    const v = name === undefined ? undefined : pending.get(name)
    if (name === undefined || v === undefined) return [line]
    // a later line for a removed name goes too
    if (v !== null) pending.delete(name)
    return v === null ? [] : [`export ${name}='${v}'`]
  })
  for (const [k, v] of pending) if (v !== null) out.push(`export ${k}='${v}'`)
  const tmp = `${file}.tmp-${process.pid}`
  fs.writeFileSync(tmp, out.join('\n') + '\n', {mode: 0o600})
  fs.chmodSync(tmp, 0o600)
  fs.renameSync(tmp, file)
}
