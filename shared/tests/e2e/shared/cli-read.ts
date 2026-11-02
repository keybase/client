// Runs of the `keybase` CLI: readCli for the visual gate's read-only reads (resolve.mts's params,
// seal.mts's seal), runCli for any call.
import {execFile} from 'child_process'
import {keybaseBin} from './keybase-bin.ts'

const CLI_TIMEOUT_MS = 30_000
const RETRY_PAUSE_MS = 1_000
// The service's own fetch from the server timing out, which a second try usually gets past (the host's
// `device list` waits 4-5s on a fetch whose deadline is about 4.8s).
const SERVICE_TIMEOUT = 'context deadline exceeded'

// The most of an unrecognised stderr kept, from its end.
const ERROR_MAX_CHARS = 2000

// libkb's log line (go/logger/formats_nix.go fileFormat, `[%{level:.4s} %{module} %{shortfile}]
// %{id:03x} %{message}`, and plainFormat's `[ERRO] %{id:03x} %{message}`): the message follows a
// hex sequence number of at least 3 digits, which every line carries (fancyFormat puts a colour reset after it).
// eslint-disable-next-line no-control-regex
const ERRO_LINE = /\[ERRO[^\]]*\]\s*[0-9a-f]{3,}(?:\x1b\[[0-9;]*m)?\s(.*)$/

// The CLI's error: from its last [ERRO ...] line (without timestamp and sequence number) to the end of
// stderr, so a message that goes on over several lines survives and the warnings ahead of it (a CLI and
// service of different builds, say) are left out. Stderr with no such line is kept whole, its tail.
export const cliError = (stderr: string, fallback: string) => {
  const lines = stderr.trimEnd().split('\n')
  const at = lines.findLastIndex(l => ERRO_LINE.test(l))
  const text =
    at < 0 ? stderr : [lines[at]?.match(ERRO_LINE)?.[1] ?? '', ...lines.slice(at + 1)].join('\n')
  return text.trim().slice(-ERROR_MAX_CHARS) || fallback
}

type RunOptions = {
  // the answer is stdout then stderr, for a CLI that prints its result there
  withStderr?: boolean
  timeoutMs?: number
}

// Runs one CLI call; its error starts with `what`.
export const runCli = async (args: ReadonlyArray<string>, what: string, {withStderr = false, timeoutMs = CLI_TIMEOUT_MS}: RunOptions = {}) =>
  new Promise<string>((resolve, reject) => {
    const proc = execFile(
      keybaseBin(),
      [...args],
      {encoding: 'utf8', killSignal: 'SIGKILL', maxBuffer: 64 * 1024 * 1024, timeout: timeoutMs},
      (err, stdout, stderr) => {
        if (err?.killed) reject(new Error(`${what}: no answer in ${timeoutMs / 1000}s`))
        else if (err) reject(new Error(`${what}: ${cliError(stderr, err.message)}`))
        else resolve(withStderr ? `${stdout}${stderr}` : stdout)
      }
    )
    proc.stdin?.end()
  })

// Runs a read-only CLI call, once more when the service failed it with its own server timeout; its
// error starts with `what`. Bound: two tries of CLI_TIMEOUT_MS and the pause, 61s.
export const readCli = async (args: ReadonlyArray<string>, what: string): Promise<string> => {
  try {
    return await runCli(args, what)
  } catch (e) {
    if (!(e instanceof Error) || !e.message.includes(SERVICE_TIMEOUT)) throw e
    await new Promise(resolve => setTimeout(resolve, RETRY_PAUSE_MS))
    return runCli(args, what)
  }
}
