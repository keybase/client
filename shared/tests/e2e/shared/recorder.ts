// The dev app's route and RPC recorder (visual/fixtures/runtime.ts), driven over a Playwright page.
// A page without it is a stale or production bundle, which fails rather than recording nothing.
import type {Page} from '@playwright/test'
import {withDeadline} from './deadline.ts'

export type Recording = {rpcs: Array<string>; routes: Array<string>; startRoutes: Array<string>}
type RecorderGlobal = {__kbE2ERecorder?: {start: (opts?: {includeBoot?: boolean}) => void; take: () => Recording}}

export const RECORDER_DEADLINE_MS = 5_000

export const startRecorder = async (page: Page, opts?: {includeBoot?: boolean}) => {
  const started = await withDeadline(
    page.evaluate(o => {
      const r = (globalThis as RecorderGlobal).__kbE2ERecorder
      r?.start(o)
      return !!r
    }, opts),
    RECORDER_DEADLINE_MS,
    'starting the route and RPC recorder'
  )
  if (!started) throw new Error('the app has no __kbE2ERecorder: reload or relaunch the dev app on the current bundle')
}

export const takeRecorder = async (page: Page): Promise<Recording> =>
  withDeadline(
    page.evaluate(() => {
      const r = (globalThis as RecorderGlobal).__kbE2ERecorder
      if (!r) throw new Error('the app has no __kbE2ERecorder')
      return r.take()
    }),
    RECORDER_DEADLINE_MS,
    'taking the route and RPC recording'
  )

// A reload drops what the page recorded so far. A flow that reloads mid-test takes it first with
// keepBeforeReload; the coverage fixture adds what was kept to its own take at the end.
const kept = new WeakMap<Page, Array<Recording>>()

export const keepBeforeReload = async (page: Page) => {
  const got = await takeRecorder(page)
  kept.set(page, [...(kept.get(page) ?? []), got])
}

// What keepBeforeReload kept for `page`, oldest first, and forgets it.
export const takeKept = (page: Page): Array<Recording> => {
  const got = kept.get(page) ?? []
  kept.delete(page)
  return got
}

// Recordings in the order they were taken, as one: the first one's startRoutes, and each route and
// RPC once in the order first seen.
export const mergeRecordings = (all: ReadonlyArray<Recording>): Recording => ({
  routes: [...new Set(all.flatMap(r => r.routes))],
  rpcs: [...new Set(all.flatMap(r => r.rpcs))],
  startRoutes: all[0]?.startRoutes ?? [],
})
