// The `keybase` CLI reads the visual gate makes (resolve.mts's params, seal.mts's seal), each one
// read-only.
import {execFile} from 'child_process'
import {keybaseBin} from '../shared/keybase-bin.ts'

const CLI_TIMEOUT_MS = 30_000
// The service's own fetch from the server timing out, which a second try usually gets past (the host's
// `device list` waits 4-5s on a fetch whose deadline is about 4.8s).
const SERVICE_TIMEOUT = 'context deadline exceeded'

// The most of an unrecognised stderr kept, from its end.
const ERROR_MAX_CHARS = 2000

// libkb's log line (go/logger/formats_nix.go fileFormat, `[%{level:.4s} %{module} %{shortfile}]
// %{id:03x} %{message}`, and plainFormat's `[ERRO] %{id:03x} %{message}`): the message follows a
// hex sequence number of at least 3 digits.
const ERRO_LINE = /\[ERRO[^\]]*\]\s*(?:[0-9a-f]{3,}\s)?(.*)$/

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

const readOnce = async (args: ReadonlyArray<string>, what: string) =>
  new Promise<string>((resolve, reject) => {
    const proc = execFile(
      keybaseBin(),
      [...args],
      {encoding: 'utf8', killSignal: 'SIGKILL', timeout: CLI_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024},
      (err, stdout, stderr) => {
        if (err?.killed) reject(new Error(`${what}: no answer in ${CLI_TIMEOUT_MS / 1000}s`))
        else if (err) reject(new Error(`${what}: ${cliError(stderr, err.message)}`))
        else resolve(stdout)
      }
    )
    proc.stdin?.end()
  })

// Runs a read-only CLI call, once more when the service failed it with its own server timeout; its
// error starts with `what`. Bound: two tries of CLI_TIMEOUT_MS, 60s.
export const readCli = async (args: ReadonlyArray<string>, what: string): Promise<string> => {
  try {
    return await readOnce(args, what)
  } catch (e) {
    if (!(e instanceof Error) || !e.message.endsWith(SERVICE_TIMEOUT)) throw e
    return readOnce(args, what)
  }
}
