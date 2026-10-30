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

// Installs the wrappers once per JS runtime (a reload starts a new one, so this is safe to call again
// after one) and clears what an earlier test left.
export const beginErrorCapture = async (): Promise<void> => {
  await evalInPage<null>(
    await page(),
    `const g = globalThis;
     if (g.__kbE2EErrorsRuntime !== g.__kbE2ERuntime || !g.__kbE2EErrors) {
       g.__kbE2EErrors = [];
       g.__kbE2EErrorsRuntime = g.__kbE2ERuntime;
       const fmt = a => (a instanceof Error ? a.name + ': ' + a.message + '\\n' + (a.stack || '') : typeof a === 'string' ? a : (() => { try { return JSON.stringify(a) } catch { return String(a) } })());
       const origError = console.error;
       console.error = function (...args) {
         try { g.__kbE2EErrors.push(args.map(fmt).join(' ')) } catch {}
         return origError.apply(this, args);
       };
       const eu = g.ErrorUtils;
       if (eu) {
         const prev = eu.getGlobalHandler();
         eu.setGlobalHandler((e, isFatal) => {
           try { g.__kbE2EErrors.push(${JSON.stringify(UNCAUGHT_PREFIX)} + fmt(e)) } catch {}
           prev(e, isFatal);
         });
       }
     } else {
       g.__kbE2EErrors.length = 0;
     }
     return null;`
  )
}

// What the app logged since beginErrorCapture or the last take, then cleared.
export const takeErrors = async (): Promise<Array<string>> =>
  (await evalInPage<Array<string> | null>(
    await page(),
    `const e = globalThis.__kbE2EErrors; if (!e) return null; return e.splice(0, e.length);`
  )) ?? []

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
