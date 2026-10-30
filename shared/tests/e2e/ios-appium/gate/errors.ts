// The app's console.error calls and uncaught JS errors during a test, collected inside its JS runtime
// (the phone has no Playwright page events) and read back over Metro's inspector.
import * as fs from 'fs'
import {evalInPage, inspectorPageFor} from '../../shared/metro-eval.ts'
import {goLogPath} from '../helpers/lifecycle'
import {tailLines, UNCAUGHT_PREFIX} from './step-lib.ts'

const DEVICE = process.env['KB_IOS_DEVICE'] ?? 'iPhoneTest'
const APP_ID = 'keybase.ios'
const LOG_READ_BYTES = 256 * 1024

const page = async () => inspectorPageFor(DEVICE, APP_ID)

// The runtime the capture was installed into: errors logged before a reload went with the old one.
let capturedRuntime: string | undefined

// RN reports an unhandled promise rejection through ExceptionsManager.handleException, not the
// ErrorUtils handler, so both are wrapped; an error ErrorUtils hands on to handleException is kept once.
const install = (clear: boolean) => `const g = globalThis;
  if (g.__kbE2EErrorsRuntime !== g.__kbE2ERuntime || !g.__kbE2EErrors) {
    g.__kbE2EErrors = [];
    g.__kbE2EErrorsRuntime = g.__kbE2ERuntime;
    const fmt = a => (a instanceof Error ? a.name + ': ' + a.message + '\\n' + (a.stack || '') : typeof a === 'string' ? a : (() => { try { return JSON.stringify(a) } catch { return String(a) } })());
    const uncaught = e => { try { g.__kbE2EErrors.push(${JSON.stringify(UNCAUGHT_PREFIX)} + fmt(e)) } catch {} };
    const origError = console.error;
    console.error = function (...args) {
      try { g.__kbE2EErrors.push(args.map(fmt).join(' ')) } catch {}
      return origError.apply(this, args);
    };
    let inGlobalHandler = false;
    const eu = g.ErrorUtils;
    if (eu) {
      const prev = eu.getGlobalHandler();
      eu.setGlobalHandler((e, isFatal) => {
        uncaught(e);
        inGlobalHandler = true;
        try { prev(e, isFatal) } finally { inGlobalHandler = false }
      });
    }
    const em = kbModule('node_modules/react-native/Libraries/Core/ExceptionsManager.js').default;
    const handleException = em.handleException;
    em.handleException = function (e, isFatal) {
      if (!inGlobalHandler) uncaught(e);
      return handleException.apply(this, arguments);
    };
  } else if (${clear}) {
    g.__kbE2EErrors.length = 0;
  }
  return g.__kbE2ERuntime ?? null;`

const installInto = async (clear: boolean) => {
  capturedRuntime = (await evalInPage<string | null>(await page(), install(clear))) ?? undefined
}

// Installs the capture once per JS runtime (a reload starts a new one, so this is safe to call again
// after one) and clears what an earlier test left.
export const beginErrorCapture = async (): Promise<void> => installInto(true)

// Installs the capture into a runtime that has none, keeping what one already holds.
export const ensureErrorCapture = async (): Promise<void> => installInto(false)

// What the app logged since beginErrorCapture or the last take, then cleared. Throws when the app has
// reloaded since the capture was installed, as what it held is gone.
export const takeErrors = async (): Promise<Array<string>> => {
  const got = await evalInPage<{errors: Array<string> | null; runtime: string | null}>(
    await page(),
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
