import type {ChainablePromiseElement, ChainablePromiseArray} from 'webdriverio'

export const el = (id: string): ChainablePromiseElement => browser.$(`~${id}`)
export const els = (id: string): ChainablePromiseArray => browser.$$(`~${id}`)

// Use waitForExist (presence in the XCUI tree), not waitForDisplayed: layout
// containers that carry screen-marker testIDs (e.g. a flex Box2 wrapping a list)
// report visible="false" to XCUITest even when on screen, so waitForDisplayed
// would spuriously fail. iOS prunes truly off-screen views from the tree, so
// existence is a reliable "this screen is active" signal.
export const waitForTestID = async (id: string, timeout = 5000) =>
  // interval 150 (vs the 500 default) so a wait returns promptly once the
  // element appears, instead of idling up to half a second per wait.
  el(id).waitForExist({timeout, interval: 150, timeoutMsg: `testID "${id}" never appeared`})

export const countTestID = async (id: string): Promise<number> => els(id).length

// Enter text by pasting from the system pasteboard instead of per-key typing.
// Appium's keyboard injection (setValue) drives UIKit's per-character a11y
// insertion path, which desyncs RN's RCTBackedTextInputDelegateAdapter cached
// range on older iOS (16.4) → NSRangeException → app SIGABRT. Pasting inserts
// the whole string in one shot via UIPasteboard, avoiding that path. The
// touch-and-hold that summons the edit menu is occasionally missed, so retry it.
export const pasteText = async (id: string, text: string): Promise<void> => {
  await browser.execute('mobile: setPasteboard', {
    content: Buffer.from(text).toString('base64'),
    encoding: 'base64',
  })
  await el(id).click()
  // Hold on the actually-focused text element, not the testID node: some testIDs
  // sit on a wrapper Box2 that also contains a banner/recipients (e.g. the crypto
  // inputs), so holding the wrapper lands above the editable area and no menu
  // appears. The keyboard-focused element is the real text field — wait for it to
  // exist (focus can lag under load) before holding.
  const focused = browser.$('-ios predicate string:hasKeyboardFocus == 1')
  await focused.waitForExist({timeout: 4000}).catch(() => {})
  const paste = browser.$(
    '-ios predicate string:type == "XCUIElementTypeMenuItem" AND (label == "Paste" OR name == "Paste")'
  )
  for (let i = 0; i < 6; i++) {
    const fid = await focused.elementId.catch(() => undefined)
    await browser
      .execute('mobile: touchAndHold', fid ? {elementId: fid, duration: 1.3} : {elementId: await el(id).elementId, duration: 1.3})
      .catch(() => {})
    const got = await paste
      .waitForExist({timeout: 1500})
      .then(() => true)
      .catch(() => false)
    if (got) {
      await paste.click().catch(() => {})
      return
    }
    await browser.pause(400)
  }
  throw new Error(`pasteText: Paste menu never appeared for "${id}"`)
}

// Tap a testID and wait for an expected testID to appear, re-tapping if it does
// not. On slow/old sims the first tap can be swallowed by an in-flight screen
// transition (e.g. the More→Crypto push that immediately precedes a sub-nav tab
// tap), so a single tap+wait is flaky. Re-tapping recovers; merely extending the
// wait does NOT — the swallowed tap never lands, so the screen never changes.
// Once a tap takes, the expected id appears and we return before re-tapping; if
// it already navigated, the re-tap hits a now-absent element and is a harmless
// no-op (caught).
export const tapForTestID = async (
  tapId: string,
  expectId: string,
  {taps = 3, timeout = 5000}: {taps?: number; timeout?: number} = {}
): Promise<void> => {
  for (let i = 0; i < taps; i++) {
    await el(tapId).click().catch(() => {})
    const ok = await el(expectId)
      .waitForExist({timeout, interval: 150})
      .then(() => true)
      .catch(() => false)
    if (ok) return
  }
  throw new Error(`tapForTestID: "${expectId}" never appeared after ${taps} taps on "${tapId}"`)
}

// Best-effort wait for at least one match. Returns false (rather than throwing)
// if none appear — for list rows that stream in after the list mounts, where
// "no rows" is a legitimate outcome and not a test failure.
export const anyExist = async (id: string, timeout = 3000): Promise<boolean> => {
  await browser
    .waitUntil(async () => (await els(id).length) > 0, {timeout, interval: 150})
    .catch(() => {})
  return (await els(id).length) > 0
}

// Backslashes and double quotes would otherwise terminate/alter the quoted
// predicate literal and make the selector invalid.
const escapePredicate = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

// CONTAINS, not ==, on purpose: many tappable rows (More menu items, team tabs)
// are ClickableBoxes whose accessibility label is a merge of child labels, e.g.
// ", Crypto" rather than "Crypto". This mirrors Maestro's substring text match.
export const byText = (text: string): ChainablePromiseElement => {
  const t = escapePredicate(text)
  return browser.$(`-ios predicate string:label CONTAINS "${t}" OR name CONTAINS "${t}"`)
}

export const tab = (label: string): ChainablePromiseElement => browser.$(`~${label}`)
