// The new device's side of adding a computer: `keybase --home <h> login <user> --devicename <name>`
// in a fresh peer home, picking `fromDevice` (the main service's device, which the app provisions
// from) when it asks which existing device to use, and handing back the verification phrase it
// prints for the other device. The CLI prompts on a terminal, so it runs under `expect` (a
// pseudo-terminal) with its output kept inside expect. Only fixed stage markers and the phrase leave
// it, and this side keeps nothing else it reads: the CLI's output holds the phrase, the account's
// device list and its name, and no error or log may carry any of them.
// Relative imports only: plain node loads this too.
import {spawn} from 'child_process'
import {keybaseBin} from '../shared/keybase-bin.ts'

// `--devicename` makes the CLI ask for a paper key, answered empty: it then provisions from a device.
const script = String.raw`
set timeout 60
log_user 0
spawn -noecho {*}$env(KB_PROV_CMD)
expect {
  -re {paper key: ?} { send "\r"; exp_continue }
  -re {Choose a device[^\n]*} {
    set choice ""
    foreach line [split $expect_out(buffer) "\n"] {
      if {[regexp {^\s*(\d+)\. \[computer\]\t(.*)$} $line -> n name] && [string trimright $name "\r "] eq $env(KB_PROV_FROM)} {
        set choice $n
      }
    }
    if {$choice eq ""} { puts "STAGE no-such-device"; exit 3 }
    send "$choice\r"
  }
  timeout { puts "STAGE timeout-before-device-choice"; exit 2 }
  eof { puts "STAGE ended-before-device-choice"; exit 4 }
}
expect {
  -re {other device:\r?\n\r?\n\t([a-z ]+)\r?\n} { puts "PHRASE $expect_out(1,string)"; flush stdout }
  timeout { puts "STAGE timeout-before-phrase"; exit 2 }
  eof { puts "STAGE ended-before-phrase"; exit 4 }
}
set timeout 180
expect {
  eof {}
  timeout { puts "STAGE timeout-after-phrase"; exit 2 }
}
lassign [wait] pid spawnid oserr code
exit $code
`

const stages = new Set([
  'ended-before-device-choice',
  'ended-before-phrase',
  'no-such-device',
  'timeout-after-phrase',
  'timeout-before-device-choice',
  'timeout-before-phrase',
])
const phraseLine = /^PHRASE ([a-z]+(?: [a-z]+)+)$/

// Reads the script's stdout. Keeps the phrase from its own line and a stage only when it is exactly
// one of the script's fixed markers; every other byte is dropped unread.
export class ProvisioneeOutput {
  phrase = ''
  private stage = ''
  private buf = ''
  feed(chunk: string) {
    this.buf += chunk
    let nl: number
    while ((nl = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, nl).replace(/\r$/, '')
      this.buf = this.buf.slice(nl + 1)
      const m = phraseLine.exec(line)
      if (m) this.phrase = m[1] ?? ''
      else if (line.startsWith('STAGE ') && stages.has(line.slice('STAGE '.length))) this.stage = line.slice('STAGE '.length)
    }
  }
  exitError(code: number | null) {
    return new Error(`keybase login exited ${code}${this.stage ? ` (${this.stage})` : ''}`)
  }
}

export type Provisionee = {
  // the phrase the CLI printed for the other device to type
  phrase: Promise<string>
  // settles once the CLI exits: resolves on a 0 exit
  done: Promise<void>
  kill: () => void
}

export const startProvisionee = (p: {home: string; user: string; deviceName: string; fromDevice: string}): Provisionee => {
  const argv = [keybaseBin(), '--no-auto-fork', '--home', p.home, 'login', p.user, '--devicename', p.deviceName]
  if (argv.some(a => /[{}\\]/.test(a))) throw new Error('refusing to run keybase login: braces or backslashes in its arguments')
  const env = {
    ...process.env,
    KB_PROV_CMD: argv.map(a => `{${a}}`).join(' '),
    KB_PROV_FROM: p.fromDevice,
    KEYBASE_SECRET_STORE_FILE: '1',
  }
  // expect's stderr (a script error) is not read either: it can quote what it matched
  const proc = spawn('expect', ['-c', script], {detached: true, env, stdio: ['ignore', 'pipe', 'ignore']})
  const out = new ProvisioneeOutput()
  let gotPhrase: (s: string) => void = () => {}
  let noPhrase: (e: Error) => void = () => {}
  const phrase = new Promise<string>((resolve, reject) => {
    gotPhrase = resolve
    noPhrase = reject
  })
  // a consumer that only awaits `done` must not see an unhandled rejection
  phrase.catch(() => {})
  proc.stdout.on('data', (d: Buffer) => {
    out.feed(d.toString())
    if (out.phrase) gotPhrase(out.phrase)
  })
  const done = new Promise<void>((resolve, reject) => {
    proc.on('error', e => {
      const err = new Error(`keybase login (under expect) could not run: ${e.message}`)
      noPhrase(err)
      reject(err)
    })
    proc.on('exit', code => {
      const err = out.exitError(code)
      noPhrase(err)
      if (code === 0) resolve()
      else reject(err)
    })
  })
  done.catch(() => {})
  return {
    done,
    kill: () => {
      if (proc.exitCode === null && proc.pid) {
        try {
          // its own process group: expect and the CLI it spawned
          process.kill(-proc.pid, 'SIGKILL')
        } catch {}
      }
    },
    phrase,
  }
}
