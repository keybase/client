// The `keybase` CLI every e2e call runs: the one built from this checkout, or KB_CLI. The account
// guard (requireMainIsSmoke) asks this same binary, so what it checked is what the calls act on.
import * as os from 'os'
import * as path from 'path'

export const keybaseBin = () => process.env['KB_CLI'] ?? path.join(os.homedir(), 'go', 'bin', 'keybase')

// argv as the Tcl list an expect script spawns with `spawn {*}$env(...)`: each argument braced.
// A brace or backslash in one would split it into other arguments, so such an argv is refused.
export const expectSpawnList = (argv: ReadonlyArray<string>, what: string) => {
  if (argv.some(a => /[{}\\]/.test(a))) throw new Error(`refusing to run ${what}: braces or backslashes in its arguments`)
  return argv.map(a => `{${a}}`).join(' ')
}
