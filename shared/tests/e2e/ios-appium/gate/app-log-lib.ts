// The Metro eval bodies of the app's log capture (app-log.ts) and the reads of what it holds, kept
// apart so jest can run them against a fake runtime.

// The most lines the capture holds: a read from a mark older than what it still holds throws.
export const APP_LOG_MAX = 5000
// the most characters of one line it keeps
export const APP_LOG_LINE_MAX = 2048

// A place in the capture: its runtime, and the seq of the first line logged after it.
export type AppLogMark = {runtime: string; seq: number}
// first: the seq of the oldest line still held (next when it holds none)
export type AppLogRead = {first: number; lines: Array<string>; next: number; runtime: string | null}

// Wraps each level of the app's logger once per JS runtime, keeping `<level> <text>` lines with a
// seq, and returns a mark at the end of what it holds. A function per level, never a for loop: in a
// Metro eval Hermes gives every closure made in a for loop the loop's last binding, so each level's
// wrapper would log as, and call, the last level. The wrapper calls the logger's own method, so
// the app logs as it did. In the same runtime a second install changes nothing.
export const appLogCaptureBody = `const g = globalThis;
  if (g.__kbE2EAppLogRuntime !== g.__kbE2ERuntime || !g.__kbE2EAppLog) {
    const logger = kbModule('logger/index.tsx').default;
    const levels = ['error', 'warn', 'info', 'action', 'debug'];
    if (!logger || levels.some(l => typeof logger[l] !== 'function')) throw new Error('the app logger has no level methods');
    const log = {lines: [], next: 0};
    const fmt = a => (typeof a === 'string' ? a : a instanceof Error ? a.message : (() => { try { return JSON.stringify(a) } catch { return String(a) } })());
    levels.forEach(level => {
      const orig = logger[level];
      logger[level] = (...args) => {
        try {
          log.lines.push([log.next++, (level + ' ' + args.map(fmt).join(' ')).slice(0, ${APP_LOG_LINE_MAX})]);
          if (log.lines.length > ${APP_LOG_MAX}) log.lines.shift();
        } catch {}
        return orig(...args);
      };
    });
    g.__kbE2EAppLog = log;
    g.__kbE2EAppLogRuntime = g.__kbE2ERuntime;
  }
  return {runtime: g.__kbE2ERuntime ?? null, seq: g.__kbE2EAppLog.next};`

// What the capture holds from `seq` on, with what readSince needs to know whether that is all of it.
export const appLogReadBody = (seq: number) => {
  if (!Number.isSafeInteger(seq) || seq < 0) throw new Error('refusing an app log mark that is not a seq')
  return `const g = globalThis, log = g.__kbE2EAppLog;
  const runtime = g.__kbE2ERuntime ?? null;
  if (!log || g.__kbE2EAppLogRuntime !== runtime) return {first: 0, lines: [], next: 0, runtime: null};
  return {first: log.lines.length ? log.lines[0][0] : log.next, lines: log.lines.filter(l => l[0] >= ${seq}).map(l => l[1]), next: log.next, runtime};`
}

// The lines logged since `mark`. Throws when the app reloaded since (the capture went with its
// runtime) or the capture dropped lines logged after the mark, so a read is never short.
export const readSince = (mark: AppLogMark, r: AppLogRead): Array<string> => {
  if (r.runtime !== mark.runtime) throw new Error(`the app reloaded since the app log mark: what it logged before is gone (runtime ${mark.runtime} became ${r.runtime ?? 'none'})`)
  if (r.first > mark.seq) throw new Error(`the app log capture dropped ${r.first - mark.seq} lines logged since the mark (it holds ${APP_LOG_MAX})`)
  return r.lines
}

// e2eMarker('log-<label>')
const markerRe = /^e2e-[0-9a-z]{5}[0-9]-log-[a-z0-9-]{1,40}$/

// Logs `marker` through the app's logger, as any app line is logged.
export const appLogMarkerBody = (marker: string) => {
  if (!markerRe.test(marker)) throw new Error('refusing an app log marker that is not a stamped log marker')
  return `kbModule('logger/index.tsx').default.info(${JSON.stringify(marker)}); return true`
}

// The lines logged before `marker`, or undefined until it shows: only a window that ends in the
// marker is known to have been captured, so an empty answer before it proves nothing.
export const linesBefore = (lines: ReadonlyArray<string>, marker: string): Array<string> | undefined => {
  const at = lines.findIndex(l => l.endsWith(` ${marker}`))
  return at < 0 ? undefined : lines.slice(0, at)
}
