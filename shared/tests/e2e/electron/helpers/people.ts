// Following the second account from the smoke account, and the profile's buttons, for the people
// flows. Only the second account is ever followed or unfollowed here, each change read back from
// `keybase list-following`.
import {expect, type Locator, type Page} from '@playwright/test'
import {loadE2EAccounts} from '@/tests/e2e/accounts/env'
import {watchOutgoingRpcs} from '@/tests/e2e/electron/helpers/chat'
import {requireMainIsSmoke, runKeybase} from '@/tests/e2e/shared/peer-service'
import * as T from '@/tests/e2e/shared/test-ids'

// whether the smoke account follows the second account, as the service lists it
export const followsSecond = async () => {
  const {secondUser} = loadE2EAccounts()
  await requireMainIsSmoke(loadE2EAccounts())
  const out = await runKeybase(['list-following'], {timeoutMs: 30_000})
  return out.split('\n').some(l => l.trim() === secondUser)
}

export const expectFollowsSecond = async (want: boolean, what: string) =>
  expect.poll(followsSecond, {message: what, timeout: 30_000}).toBe(want)

// Puts the smoke account's follow of the second account to `want` from the CLI and reads it back; a
// no-op when it already is.
export const setFollowSecondFromCli = async (want: boolean) => {
  if ((await followsSecond()) === want) return
  const {secondUser} = loadE2EAccounts()
  await runKeybase(want ? ['follow', secondUser, '-y'] : ['unfollow', secondUser], {timeoutMs: 60_000})
  await expectFollowsSecond(want, `the follow state of the second account put back to ${want ? 'following' : 'not following'}`)
}

export const visibleProfile = (page: Page) => page.getByTestId(T.PROFILE_PAGE).locator('visible=true').first()

// a button by its label: the profile's counts also read "Following"
export const button = (scope: Locator, label: string | RegExp) =>
  scope.locator('[class*="button--type-"]').filter({hasText: typeof label === 'string' ? new RegExp(`^${label}$`) : label}).first()

// a Follow button reads "Follow back" when they follow you
export const followLabel = (scope: Locator) => button(scope, /^Follow( back)?$/)

const trackingChanged = 'keybase.1.NotifyTracking.trackingChanged'
const identifyResult = 'keybase.1.identify3Ui.identify3Result'

type EngineListener = (a: {payload: {params: {username?: string; guiID?: string}}}) => void
type TrackingWatch = {counts: Map<string, number>; results: Set<string>}
type TrackingGlobals = {
  __hmr_engineActionListeners?: Map<string, Set<EngineListener>>
  __kbE2ETracking?: TrackingWatch
}

// Records, in the main window, the trackingChanged notifications per user and the guiIDs whose
// identify has reported its result. Read-only: one more listener on each of the two actions on the
// engine's action bus, installed once per page load.
const installTrackingWatch = async (page: Page) =>
  page.evaluate(
    ([changedType, resultType]) => {
      const g = globalThis as unknown as TrackingGlobals
      if (g.__kbE2ETracking) return
      const listeners = g.__hmr_engineActionListeners
      if (!listeners) throw new Error('the engine action listeners are not on globalThis; is this a dev build?')
      const w: TrackingWatch = {counts: new Map(), results: new Set()}
      const listen = (type: string, l: EngineListener) => {
        let set = listeners.get(type)
        if (!set) {
          set = new Set()
          listeners.set(type, set)
        }
        set.add(l)
      }
      listen(changedType, a => {
        const u = (a.payload.params.username ?? '').toLowerCase()
        w.counts.set(u, (w.counts.get(u) ?? 0) + 1)
      })
      listen(resultType, a => {
        if (a.payload.params.guiID) w.results.add(a.payload.params.guiID)
      })
      g.__kbE2ETracking = w
    },
    [trackingChanged, identifyResult] as const
  )

// Presses a Follow or Unfollow (`press`) for the second account in one place (a profile, a card
// or a tracker window) and waits until that place has settled on it; returns the guiID it settled
// on. The service sends trackingChanged for the user twice after a follow (once from the follow,
// once when it next loads the signed-in user's sigchain and finds the new link) and once after an
// unfollow, and the place reloads its identify under a new guiID on each; a press during a reload
// goes to an identify that is not ready or no longer current. Settled: every notification in, an
// identify started for each, and the latest one has reported its result.
export const pressFollowChange = async (page: Page, follow: boolean, what: string, press: () => Promise<void>) => {
  const user = loadE2EAccounts().secondUser.toLowerCase()
  const want = follow ? 2 : 1
  await installTrackingWatch(page)
  await page.evaluate(u => (globalThis as unknown as TrackingGlobals).__kbE2ETracking!.counts.set(u, 0), user)
  const rpcs = await watchOutgoingRpcs(page)
  let state = {latest: '', notified: 0, resulted: false, started: 0}
  try {
    await press()
    await expect
      .poll(
        async () => {
          const guiIDs = rpcs
            .seen()
            // the log prints the params as `{assertion: <name>, guiID: <id>, ...}`
            .filter(c => c.method === 'keybase.1.identify3.identify3' && /assertion: ([^,}]+)/.exec(c.params)?.[1]?.toLowerCase() === user)
            .map(c => /guiID: ([^,}]+)/.exec(c.params)?.[1] ?? '')
          const latest = guiIDs.at(-1) ?? ''
          const [notified, resulted] = await page.evaluate(
            ([u, g]) => {
              const w = (globalThis as unknown as TrackingGlobals).__kbE2ETracking!
              return [w.counts.get(u) ?? 0, !!g && w.results.has(g)] as const
            },
            [user, latest] as const
          )
          state = {latest, notified, resulted, started: guiIDs.length}
          return notified >= want && guiIDs.length >= want && resulted
        },
        {message: `${what}: ${want} trackingChanged notifications, an identify for each, the latest one done`, timeout: 30_000}
      )
      .toBe(true)
  } catch (e) {
    throw new Error(`${what}: ${JSON.stringify(state)}`, {cause: e})
  } finally {
    await rpcs.stop()
  }
  return state.latest
}
