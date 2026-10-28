// The dev app's route and RPC recorder (visual/fixtures/runtime.ts), driven over a Playwright page.
// A page without it is a stale or production bundle, which fails rather than recording nothing.
import type {Page} from '@playwright/test'
import {withDeadline} from './deadline.ts'

export type Recording = {rpcs: Array<string>; routes: Array<string>; startRoutes: Array<string>}
type RecorderGlobal = {__kbE2ERecorder?: {start: () => void; take: () => Recording}}

export const RECORDER_DEADLINE_MS = 5_000

export const startRecorder = async (page: Page) => {
  const started = await withDeadline(
    page.evaluate(() => {
      const r = (globalThis as RecorderGlobal).__kbE2ERecorder
      r?.start()
      return !!r
    }),
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
