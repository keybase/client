// Errors from a child process whose argv may hold a link, a path or a name (an openurl link names an
// account, an addmedia path the host's home): the error says what failed and how, never the argv, and
// the child's stderr has every hidden argument replaced, since tools echo what they were given.

// simctl arguments shown as they are: the subcommands and keywords the gate passes, and a device's
// UDID. Anything else (a link, a path, a bundle id, coordinates, a predicate, a time, a name) is
// hidden, a letters-only one included.
const SHOWN_WORDS = new Set([
  // subcommands
  'addmedia', 'boot', 'bootstatus', 'get_app_container', 'launch', 'list', 'location', 'openurl', 'privacy', 'push', 'shutdown',
  'spawn', 'terminate',
  // their keywords and flags
  '-b', '--info', '--predicate', '--start', '--style', 'available', 'booted', 'compact', 'data', 'devices', 'grant', 'groups',
  'launchctl', 'log', 'reset', 'revoke', 'set', 'show',
  // privacy services
  'all', 'calendar', 'camera', 'contacts', 'contacts-limited', 'location', 'location-always', 'media-library', 'microphone',
  'motion', 'photos', 'photos-add', 'reminders', 'siri',
])
const UDID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i

export const hiddenSimctlArgs = (args: ReadonlyArray<string>) => args.slice(1).filter(a => a !== '' && !SHOWN_WORDS.has(a) && !UDID.test(a))

const HIDDEN = '<hidden>'

// `text` with each name replaced by its role (longest name first, so a name inside another goes too).
export const maskedByRole = (text: string, roles: ReadonlyArray<{name: string; role: string}>) =>
  [...roles].filter(r => r.name).sort((a, b) => b.name.length - a.name.length).reduce((t, r) => t.split(r.name).join(r.role), text)

export const scrub = (text: string, hidden: ReadonlyArray<string>) => maskedByRole(text, hidden.map(name => ({name, role: HIDDEN})))

type ChildError = {code?: unknown; signal?: unknown; status?: unknown; stderr?: unknown}

// The error to throw for `what` (e.g. "simctl openurl") failing with `e` from execFileSync.
export const maskedRunError = (what: string, e: unknown, timeoutMs: number, hidden: ReadonlyArray<string>): Error => {
  const c = (e && typeof e === 'object' ? e : {}) as ChildError
  if (c.code === 'ETIMEDOUT') return new Error(`${what} did not finish within ${timeoutMs / 1000}s; killed it`)
  const how =
    typeof c.status === 'number'
      ? `exit ${c.status}`
      : typeof c.signal === 'string'
        ? `signal ${c.signal}`
        : typeof c.code === 'string'
          ? c.code
          : 'no exit status'
  const stderr = typeof c.stderr === 'string' ? c.stderr : Buffer.isBuffer(c.stderr) ? c.stderr.toString('utf8') : ''
  const detail = scrub(stderr.trim(), hidden)
  return new Error(`${what} failed (${how})${detail ? `: ${detail}` : ''}`)
}
