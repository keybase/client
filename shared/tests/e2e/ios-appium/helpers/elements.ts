import type {ChainablePromiseElement, ChainablePromiseArray} from 'webdriverio'

export const el = (id: string): ChainablePromiseElement => browser.$(`~${id}`)
export const els = (id: string): ChainablePromiseArray => browser.$$(`~${id}`)

// Use waitForExist (presence in the XCUI tree), not waitForDisplayed: layout
// containers that carry screen-marker testIDs (e.g. a flex Box2 wrapping a list)
// report visible="false" to XCUITest even when on screen, so waitForDisplayed
// would spuriously fail. iOS prunes truly off-screen views from the tree, so
// existence is a reliable "this screen is active" signal.
export const waitForTestID = async (id: string, timeout = 5000) =>
  el(id).waitForExist({timeout, timeoutMsg: `testID "${id}" never appeared`})

export const countTestID = async (id: string): Promise<number> => els(id).length

// CONTAINS, not ==, on purpose: many tappable rows (More menu items, team tabs)
// are ClickableBoxes whose accessibility label is a merge of child labels, e.g.
// ", Crypto" rather than "Crypto". This mirrors Maestro's substring text match.
export const byText = (text: string): ChainablePromiseElement =>
  browser.$(`-ios predicate string:label CONTAINS "${text}" OR name CONTAINS "${text}"`)

export const tab = (label: string): ChainablePromiseElement => browser.$(`~${label}`)
