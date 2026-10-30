// The app's console.error calls and uncaught JS errors during a test, collected inside its JS runtime
// (the phone has no Playwright page events) and read back over Metro's inspector.
import * as fs from 'fs'
import {goLogPath, jsEval} from '../helpers/lifecycle'
import {errorCaptureBody} from './errors-lib.ts'
import {tailLines} from './step-lib.ts'

const LOG_READ_BYTES = 256 * 1024

// The runtime the capture was installed into: errors logged before a reload went with the old one.
let capturedRuntime: string | undefined

const installInto = async (clear: boolean) => {
  capturedRuntime = (await jsEval<string | null>(errorCaptureBody(clear))) ?? undefined
}

// Installs the capture once per JS runtime (a reload starts a new one, so this is safe to call again
// after one) and clears what an earlier test left.
export const beginErrorCapture = async (): Promise<void> => installInto(true)

// Installs the capture into a runtime that has none, keeping what one already holds.
export const ensureErrorCapture = async (): Promise<void> => installInto(false)

// What the app logged since beginErrorCapture or the last take, then cleared. Throws when the app has
// reloaded since the capture was installed, as what it held is gone.
export const takeErrors = async (): Promise<Array<string>> => {
  const got = await jsEval<{errors: Array<string> | null; runtime: string | null}>(
    `const g = globalThis, e = g.__kbE2EErrors;
     return {errors: e && g.__kbE2EErrorsRuntime === g.__kbE2ERuntime ? e.splice(0, e.length) : null, runtime: g.__kbE2ERuntime ?? null};`
  )
  if (!got.errors || got.runtime !== capturedRuntime) {
    throw new Error(`the app reloaded without a checkpoint: its errors before the reload are lost (runtime ${capturedRuntime ?? 'none'} became ${got.runtime ?? 'none'})`)
  }
  return got.errors
}

// The end of the app's Go service log (ios.log).
export const appLogTail = (lines = 80): string => {
  const fd = fs.openSync(goLogPath(), 'r')
  try {
    const size = fs.fstatSync(fd).size
    const len = Math.min(size, LOG_READ_BYTES)
    const buf = Buffer.alloc(len)
    fs.readSync(fd, buf, 0, len, size - len)
    return tailLines(buf.toString('utf8'), lines)
  } finally {
    fs.closeSync(fd)
  }
}
