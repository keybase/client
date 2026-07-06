import type {ChainablePromiseElement, ChainablePromiseArray} from 'webdriverio'

// Select by testID. React Native maps testID to different native attributes per
// platform: iOS → accessibilityIdentifier (Appium "~" accessibility-id), Android
// → the view's resource-id. So the same testID needs a different selector each
// platform. (On Android "~" matches content-desc/accessibilityLabel, NOT testID.)
const byTestIDSelector = (id: string): string =>
  browser.isAndroid ? `android=new UiSelector().resourceId("${id}")` : `~${id}`

export const el = (id: string): ChainablePromiseElement => browser.$(byTestIDSelector(id))
export const els = (id: string): ChainablePromiseArray => browser.$$(byTestIDSelector(id))

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

// True for the iOS-16.4 "Old" sims (device name ends in "Old"), set per device
// by the runner via KB_IOS_DEVICE.
const isOldDevice = (): boolean => /old$/i.test(process.env['KB_IOS_DEVICE'] ?? '')

// Enter text into a field. The testID is on the real input element (see Input3),
// so el(id) is the editable itself. iOS-16.4 sims must paste (per-key injection
// crashes RN there — see pasteText). On modern iOS, setValue works where the
// input surfaces as a settable element (chat, sign, iPhone); the modern-iPad
// encrypt input surfaces as an XCUIElementTypeOther (setValue → "element wasn't
// found"), so fall back to pasting, which works regardless of element type.
export const enterText = async (id: string, text: string): Promise<void> => {
  if (browser.isAndroid) {
    await androidEnterText(id, text)
    return
  }
  if (isOldDevice()) {
    await pasteText(id, text)
    return
  }
  try {
    await el(id).setValue(text)
  } catch {
    await pasteText(id, text)
  }
}

// Android: a RN testID lands on the wrapper View, not the EditText itself, so
// setValue on the testID'd node fails ("Cannot set the element to ..."). The
// crypto input wrappers carry collapsable={false} so the wrapper keeps its
// EditText descendants (without it RN view-flattening renders the wrapper as an
// empty leaf). Resolve the real editable field: (1) the EditText carrying the
// resource-id; (2) the LAST EditText descendant of the wrapper — the PRIMARY
// input is last (encrypt renders the "Search people" recipients field before the
// message input); (3) the last EditText on screen as a final fallback.
const androidEnterText = async (id: string, text: string): Promise<void> => {
  const selfEdit = browser.$(
    `android=new UiSelector().resourceId("${id}").className("android.widget.EditText")`
  )
  let field: WebdriverIO.Element | undefined
  if (await selfEdit.isExisting().catch(() => false)) {
    field = await selfEdit.getElement()
  } else {
    const within = await el(id).$$('.//android.widget.EditText').getElements()
    const onScreen = within.length > 0 ? within : await browser.$$('//android.widget.EditText').getElements()
    field = onScreen[onScreen.length - 1]
  }
  if (!field) throw new Error(`androidEnterText: no EditText found for "${id}"`)
  await field.click().catch(() => {})
  await field.setValue(text)
}

// Enter text by pasting from the system pasteboard instead of per-key typing.
// Appium's keyboard injection (setValue) drives UIKit's per-character a11y
// insertion path, which desyncs RN's RCTBackedTextInputDelegateAdapter cached
// range on older iOS (16.4) → NSRangeException → app SIGABRT. Pasting inserts
// the whole string in one shot via UIPasteboard, avoiding that path. Also the
// modern-iPad fallback for inputs that don't expose as a settable element.
// Everything here is element-based (the testID is on the real input) — no
// coordinates: focus the field, long-press IT to raise the edit menu, tap Paste.
export const pasteText = async (id: string, text: string): Promise<void> => {
  await browser.execute('mobile: setPasteboard', {
    content: Buffer.from(text).toString('base64'),
    encoding: 'base64',
  })
  const field = await el(id).getElement()
  await field.click().catch(() => {})
  // The edit menu exposes THREE "Paste" nodes — a MenuItem, a non-tappable
  // StaticText, and an "assistantPaste:" Button. Match only the tappable
  // MenuItem/Button (matching the StaticText clicks a no-op and nothing pastes).
  const paste = browser.$(
    '-ios predicate string:(type == "XCUIElementTypeMenuItem" OR type == "XCUIElementTypeButton") AND (name == "Paste" OR label == "Paste")'
  )
  // The long-press that summons the menu is occasionally swallowed, so retry it.
  for (let i = 0; i < 6; i++) {
    await browser.execute('mobile: touchAndHold', {elementId: field.elementId, duration: 1.3}).catch(() => {})
    const shown = await paste
      .waitForExist({timeout: 1500})
      .then(() => true)
      .catch(() => false)
    if (shown) {
      await paste.click().catch(() => {})
      return
    }
    await browser.pause(300)
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
// Android: a row's text can surface either as the TextView's text OR (when the
// touchable is accessible) as the parent's content-desc, so match both; the
// visible-text path uses textContains, the merged-label path content-desc.
export const byText = (text: string): ChainablePromiseElement => {
  const t = escapePredicate(text)
  if (browser.isAndroid) {
    // xpath (not UiSelector) so we can OR the visible-text and merged-label
    // (content-desc) paths in one selector.
    return browser.$(`//*[contains(@text, "${t}") or contains(@content-desc, "${t}")]`)
  }
  return browser.$(`-ios predicate string:label CONTAINS "${t}" OR name CONTAINS "${t}"`)
}

// Tab-bar buttons. iOS exposes the native UITabBarItem by its title as the
// accessibility id. Android's tab bar is a native Material BottomNavigationView:
// target the ITEM view via its content-desc — the label, plus an optional badge
// suffix ("Chat, 1 new notification"), hence the anchored regex. Not the label
// TextViews: each item keeps BOTH a small and large label view (selected vs not)
// and UiSelector also matches the currently-invisible twin, whose bogus bounds
// make the click silently no-op. Not bare text either: screen content can carry
// the same text (the settings root's "Files"/"Chat" rows) and would eat the tap.
export const tab = (label: string): ChainablePromiseElement =>
  browser.isAndroid
    ? browser.$(`android=new UiSelector().descriptionMatches("^${label}(,.*)?$")`)
    : browser.$(`~${label}`)
