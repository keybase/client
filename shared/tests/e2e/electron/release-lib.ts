// The release command's decisions, kept free of I/O so they can be tested: whether a run may
// start (preflightProblems), and the renderer watchdog's verdicts.
import type {PortHolder} from '../shared/gate/ports.ts'
import {commonPreflightProblems, serviceAccountName, type CommonPreflightState} from '../shared/gate/release-lib.ts'
import {INSPECTOR_PORT} from './helpers/main-process-lib.ts'

// The ports the run's app listens on, which must be free or held by the app launch-app.mts started:
// the dev server, the renderer's CDP and the main process's inspector (helpers/main-process.ts).
export const RELEASE_PORTS: ReadonlyArray<number> = [4000, 9222, INSPECTOR_PORT]

export type PreflightState = CommonPreflightState & {
  // `user` is who the main service is signed in as ('' when nobody)
  whoami: {ok: true; user: string} | {ok: false; error: string}
  smokeUser: string
  secondUser: string
  // `error` when lsof could not say who listens
  ports: ReadonlyArray<{port: number; holders: ReadonlyArray<PortHolder>; error?: string}>
  // the process group launch-app.mts recorded for the app it started, if any
  appPgid: number | undefined
}

// Every reason the run must not start, each saying what to do about it. Empty: go ahead.
export const preflightProblems = (s: PreflightState): Array<string> =>
  commonPreflightProblems(
    s,
    () => {
      const out: Array<string> = []
      if (!s.whoami.ok) {
        out.push(`the main keybase service does not answer whoami (${s.whoami.error}); start it signed in as KB_SMOKE_USER`)
      } else if (s.whoami.user !== s.smokeUser) {
        out.push(
          `the main keybase service is signed in as ${serviceAccountName(s.whoami.user, s)}, not KB_SMOKE_USER; ` +
            'sign it back in yourself (the release command never switches it)'
        )
      }
      for (const {error, port, holders} of s.ports) {
        if (error !== undefined) out.push(`could not tell whether port ${port} is free (${error}); fix lsof and rerun`)
        for (const h of holders) {
          if (s.appPgid !== undefined && h.pgid === s.appPgid) continue
          out.push(`port ${port} is held by pid ${h.pid} (${h.command}), which launch-app.mts did not start; stop it to free the port`)
        }
      }
      return out
    },
    {lockedWhy: 'a locked session refuses the window its fullscreen (the video flows need it)'}
  )

// ---------------------------------------------------------------- renderer watchdog

// What the watchdog reads from main.html each poll: #root and what it holds. main.html ships #root
// holding one static `title="loading..."` placeholder, which React replaces. Every reload shows it
// until the app's entry runs; a renderer whose module failed to load keeps showing only that, as a
// white page.
export type RendererProbe = {hasRoot: boolean; rootChildren: number; placeholderOnly: boolean}

export type BadKind = 'blank' | 'gone' | 'unanswered'
export type WatchSample = {kind: 'ok'} | {kind: BadKind | 'loading'; detail: string}

export const probeSample = (p: RendererProbe): WatchSample => {
  if (!p.hasRoot) return {detail: 'main.html has no #root', kind: 'blank'}
  if (p.rootChildren === 0) return {detail: '#root is empty', kind: 'blank'}
  if (p.placeholderOnly) return {detail: '#root holds only the static loading placeholder', kind: 'loading'}
  return {kind: 'ok'}
}

// A renderer blank, missing or silent for this long has gone blank.
export const WATCH_THRESHOLD_MS = 10_000
// Showing the placeholder is a reload in progress, which checkRendererAfterReload (the flows' own
// reloads and global-setup's) gives 20s: only a page still on it after this long is stuck.
export const WATCH_LOADING_THRESHOLD_MS = 30_000

type BadSample = Exclude<WatchSample, {kind: 'ok'}>
// badSince: the first poll of this bad stretch; hardSince: the first of its latest run of polls
// that were bad other than loading
export type WatchState = {badSince?: number; hardSince?: number; first?: BadSample}
export type WatchAlarm = {kind: BadKind; text: string}

// One good poll resets both clocks; after an alarm they start over.
export const nextWatch = (
  state: WatchState,
  sample: WatchSample,
  now: number,
  thresholds: {badMs?: number; loadingMs?: number} = {}
): {state: WatchState; alarm?: WatchAlarm} => {
  if (sample.kind === 'ok') return {state: {}}
  const badMs = thresholds.badMs ?? WATCH_THRESHOLD_MS
  const loadingMs = thresholds.loadingMs ?? WATCH_LOADING_THRESHOLD_MS
  const badSince = state.badSince ?? now
  const hardSince = sample.kind === 'loading' ? undefined : (state.hardSince ?? now)
  const first = state.first ?? sample
  const hardLong = hardSince !== undefined && now - hardSince >= badMs
  if (!hardLong && now - badSince < loadingMs) return {state: {badSince, first, ...(hardSince === undefined ? {} : {hardSince})}}
  const why =
    sample.kind === 'gone'
      ? 'its target is gone'
      : sample.kind === 'unanswered'
        ? 'it does not answer'
        : sample.kind === 'loading'
          ? 'it shows only the loading placeholder'
          : 'it is blank'
  const kind: BadKind = sample.kind === 'loading' ? 'blank' : sample.kind
  return {alarm: {kind, text: `${why} for ${Math.round((now - badSince) / 1000)}s (${sample.detail}; first: ${first.detail})`}, state: {}}
}

// The watchdog's incidents. The run's first alarm reloads the renderer; after that each phase
// records at most one more incident per state, and later alarms of that state only count.
export type IncidentBook = {
  reloaded: boolean
  entries: Array<{phase: string; kind: BadKind; text: string; afterReload: boolean; count: number}>
}
export const emptyIncidentBook = (): IncidentBook => ({entries: [], reloaded: false})

export const noteAlarm = (
  book: IncidentBook,
  phase: string,
  kind: BadKind,
  text: string
): {book: IncidentBook; action: 'reload' | 'record' | 'count'} => {
  if (!book.reloaded) {
    return {action: 'reload', book: {entries: [...book.entries, {afterReload: false, count: 1, kind, phase, text}], reloaded: true}}
  }
  const i = book.entries.findIndex(e => e.afterReload && e.phase === phase && e.kind === kind)
  if (i >= 0) {
    const entries = book.entries.map((e, j) => (j === i ? {...e, count: e.count + 1} : e))
    return {action: 'count', book: {...book, entries}}
  }
  return {action: 'record', book: {...book, entries: [...book.entries, {afterReload: true, count: 1, kind, phase, text}]}}
}

export const incidentLines = (book: IncidentBook) =>
  book.entries.map(e => (e.count > 1 ? `${e.text} (and ${e.count - 1} more ${e.count === 2 ? 'time' : 'times'})` : e.text))
