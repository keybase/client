// The host's `keybase` CLI (and the desktop service behind it). The gates keep the host signed in as
// KB_SMOKE_USER and have the second account's peer service send its messages (peer-actors.ts). A
// call that would prompt is never answered: stdin is closed and the call has a deadline, so it fails
// instead of hanging.
import {execFile} from 'child_process'
import {keybaseBin} from './keybase-bin.ts'

const run = async (args: Array<string>, timeoutMs: number) =>
  new Promise<string>((resolve, reject) => {
    const proc = execFile(
      keybaseBin(),
      args,
      {encoding: 'utf8', killSignal: 'SIGKILL', timeout: timeoutMs},
      (err, stdout, stderr) => {
        if (err?.killed) reject(new Error(`keybase ${args.join(' ')}: no answer in ${timeoutMs / 1000}s`))
        else if (err) reject(new Error(`keybase ${args.join(' ')}: ${stderr || err.message}`))
        else resolve(stdout.trim())
      }
    )
    proc.stdin?.end()
  })

export const cliWhoami = async () => run(['whoami'], 15_000)

// One `keybase chat api` call as the host's service account: its result, or a throw with the error
// it answered.
export const cliChatApi = async (message: object, timeoutMs = 30_000): Promise<unknown> => {
  const out = await run(['chat', 'api', '-m', JSON.stringify(message)], timeoutMs)
  const reply = JSON.parse(out) as {error?: {message?: string}; result?: unknown}
  if (reply.error) throw new Error(`keybase chat api ${JSON.stringify(message)}: ${reply.error.message ?? out}`)
  return reply.result
}

