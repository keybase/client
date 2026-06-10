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
