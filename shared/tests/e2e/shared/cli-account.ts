// Which account the host's `keybase` CLI (and the desktop service behind it) acts as. The gate keeps
// the host signed in as KB_SMOKE_USER and has the second account's peer service send its messages
// (peer-actors.ts); only the old iOS chat runner (wdio.chat.conf.ts) switches the host to
// KB_SECOND_USER for its run and back afterwards.
//
// `keybase login --switch <user>` swaps between accounts already signed in on this machine without
// a prompt. One that would prompt (an account never signed in here) is never answered: stdin is
// closed and the call has a deadline, so it fails instead of hanging.
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

// Switches the host's service to `username` and checks it took.
export const switchCliAccount = async (username: string) => {
  if ((await cliWhoami().catch(() => '')) === username) return
  await run(['login', '--switch', username], 60_000)
  const now = await cliWhoami()
  if (now !== username) throw new Error(`the host's keybase CLI is ${now || 'signed out'} after switching to ${username}`)
}
