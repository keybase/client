// Errors from a child process whose argv may hold a link, a path or a name (an openurl link names an
// account, an addmedia path the host's home): the error says what failed and how, never the argv, and
// the child's stderr has every hidden argument replaced, since tools echo what they were given.

// simctl arguments shown as they are: the subcommand's keywords and a device's UDID. Anything else
// (a link, a path, a bundle id, coordinates, a predicate) is hidden.
const SHOWN_ARG = /^(?:-?[a-z_]+(?:-[a-z_]+)*|[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12})$/i

export const hiddenSimctlArgs = (args: ReadonlyArray<string>) => args.slice(1).filter(a => a !== '' && !SHOWN_ARG.test(a))

const HIDDEN = '<hidden>'

export const scrub = (text: string, hidden: ReadonlyArray<string>) =>
  [...hidden].sort((a, b) => b.length - a.length).reduce((t, h) => (h ? t.split(h).join(HIDDEN) : t), text)

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
