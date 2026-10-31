// The phone's system UI around the app: notification banners, Notification Center and the home
// screen. Like device.ts these credit nothing: a flow credits 'push-notification' once it has
// asserted what the app did with the notification. Every find has a deadline and answers a bounded
// result; errors are thrown, never read as "not shown".
import {
  appSnapshot,
  closeNotificationCenter,
  lookFor,
  openNotificationCenter,
  shownWithLabel,
  withSpringboard,
} from '../helpers/lifecycle'
import {e2eRunId} from '../../shared/run-marker.ts'
import {clearGatePoison, poisonGate} from './poison-lib.ts'

const BANNER_MS = 8_000
// clearing a few of this run's notifications, one swipe and tap each
const CLEAR_MS = 30_000
const CLOSED_MS = 10_000
const NOTIFICATION_CENTER = 'Notification Center'

// A notification body goes into an XCUITest predicate: only a stamped marker's characters.
const requirePlain = (text: string) => {
  if (!/^[A-Za-z0-9_.-]{1,120}$/.test(text)) throw new Error('refusing a notification text that is not a stamped marker')
  return text
}

// The banner showing `body` (its button, which takes the tap), or undefined when none shows within
// `timeout`.
export const findBanner = async (body: string, timeout = BANNER_MS) => {
  const text = requirePlain(body)
  return withSpringboard(async () => shownWithLabel(text, timeout))
}

export const tapBanner = async (body: string, timeout = BANNER_MS) => {
  const text = requirePlain(body)
  await withSpringboard(async () => {
    const el = await shownWithLabel(text, timeout)
    if (!el) throw new Error(`no notification showed ${text} within ${timeout}ms`)
    await el.click()
  })
}

// Brings the home screen to the front: the app goes to the background as when the person leaves it.
export const springboardActivate = async () => browser.execute('mobile: activateApp', {bundleId: 'com.apple.springboard'})

const clearButton = () => browser.$('-ios predicate string:type == "XCUIElementTypeButton" AND label == "Clear"')

// Swipes each of this run's notifications (their bodies carry e2e-<runid>-push) aside and taps Clear,
// until Notification Center shows none.
const clearRunNotifications = async () => {
  const stamp = `e2e-${e2eRunId()}-push`
  const end = Date.now() + CLEAR_MS
  for (;;) {
    const shown = await shownWithLabel(stamp, 0)
    if (!shown) return
    if (Date.now() > end) throw new Error(`Notification Center still shows this run's notifications after ${CLEAR_MS}ms of clearing`)
    await browser.execute('mobile: swipe', {direction: 'left', elementId: shown.elementId})
    const clear = await lookFor(async () => ((await clearButton().isExisting()) ? clearButton() : undefined), {timeout: 3_000})
    if (!clear) throw new Error(`Notification Center showed no Clear for one of this run's notifications`)
    await clear.click()
  }
}

// Opens Notification Center over the app, runs `fn` with a bounded find inside it, then clears this
// run's notifications and closes it. Notification Center left open (or this run's notifications left
// in it) leaves the app inactive for every later flow, so a clear or close that fails poisons the
// gate and throws; one that works clears that poison.
export const withNotificationCenter = async <R,>(fn: (find: (body: string) => ReturnType<typeof findBanner>) => Promise<R>): Promise<R> => {
  await openNotificationCenter()
  let out: R | undefined
  let failure: Error | undefined
  try {
    out = await withSpringboard(async () => fn(async body => shownWithLabel(requirePlain(body), BANNER_MS)))
  } catch (e) {
    failure = e instanceof Error ? e : new Error(String(e))
  }
  try {
    await withSpringboard(clearRunNotifications)
    await closeNotificationCenter()
    const active = await lookFor(async () => ((await appSnapshot()).mobileAppState === 'active' ? true : undefined), {interval: 500, timeout: CLOSED_MS})
    if (!active) throw new Error(`the app was not active again within ${CLOSED_MS}ms of closing Notification Center`)
  } catch (e) {
    poisonGate(NOTIFICATION_CENTER, "clear this run's notifications in the simulator's Notification Center and swipe it closed")
    const why = `putting back Notification Center failed: ${e instanceof Error ? e.message : String(e)}`
    throw failure ? new AggregateError([failure, e], `${failure.message}; and then ${why}`) : new Error(why, {cause: e})
  }
  clearGatePoison(NOTIFICATION_CENTER)
  if (failure) throw failure
  return out as R
}
