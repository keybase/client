// Helpers for the iOS crypto flows: the crypto sub-nav, reached from the More tab's Crypto row (the
// phone's only way in: it is the settingsTabs.cryptoTab screen, never desktop's cryptoRoot tab), an
// operation's input screen opened from its row and left by its back, and the output modal closed by
// its header's Done.
import * as T from '../../shared/test-ids'
import {jsEval} from '../gate/app-ask'
import {el, pasteFromMenu, tapForTestID, waitForTestID} from './elements'
import {expectScreen} from '../gate/screens'
import {fiberPrelude} from './fiber-prelude'
import {waitFor} from './lifecycle'
import {check} from './menus'
import {escapeToTabs, goBackUntilGone, navigateToMore, tapSettingsRow} from './navigate'
import {tapHeaderAction} from './teams'

export const CRYPTO_SUB_NAV = 'settingsTabs.cryptoTab'

export type CryptoTab = 'decrypt' | 'encrypt' | 'sign' | 'verify'

// Each operation's sub-nav row, its input screen's marker and route, and its output modal's route.
export const CRYPTO_TABS = {
  decrypt: {input: T.CRYPTO_DECRYPT_INPUT, nav: T.CRYPTO_NAV_DECRYPT, output: 'decryptOutput', route: 'decryptTab'},
  encrypt: {input: T.CRYPTO_ENCRYPT_INPUT, nav: T.CRYPTO_NAV_ENCRYPT, output: 'encryptOutput', route: 'encryptTab'},
  sign: {input: T.CRYPTO_SIGN_INPUT, nav: T.CRYPTO_NAV_SIGN, output: 'signOutput', route: 'signTab'},
  verify: {input: T.CRYPTO_VERIFY_INPUT, nav: T.CRYPTO_NAV_VERIFY, output: 'verifyOutput', route: 'verifyTab'},
} as const

// The crypto sub-nav, from wherever the app is. Bound: escapeToTabs 30, the More tab 15, the row 54,
// the screen 11, the sub-nav 5 = 115.
export const openCrypto = async () => {
  await escapeToTabs()
  await navigateToMore()
  await tapSettingsRow('Crypto')
  await expectScreen('the crypto sub-nav', CRYPTO_SUB_NAV)
  await waitForTestID(T.CRYPTO_INPUT, 5_000)
}

// The operation's input screen, from the sub-nav. Bound: tapForTestID 18 (three taps 1 and 5s
// waits), the screen 11 = 29.
export const openCryptoTab = async (tab: CryptoTab) => {
  const {input, nav, route} = CRYPTO_TABS[tab]
  await tapForTestID(nav, input)
  await expectScreen(`the ${tab} screen`, route)
}

// Back from the operation's input screen to the sub-nav, with its field's box gone (the field itself
// is inside the box's one element, never in the tree). Bound: goBackUntilGone 12 (three backs 1 and
// 3s waits), the screen 11, the box 1 = 24.
export const leaveCryptoTab = async (tab: CryptoTab) => {
  await goBackUntilGone(CRYPTO_TABS[tab].input)
  await expectScreen(`the crypto sub-nav after the ${tab} screen`, CRYPTO_SUB_NAV)
  check(!(await el(CRYPTO_TABS[tab].input).isExisting()), `the ${tab} screen's field is still drawn`)
}

// Closes the output modal by its header's Done, back to the operation's input screen. Bound:
// tapHeaderAction 6, the screen 11, the output gone 5 = 22.
export const closeCryptoOutput = async (tab: CryptoTab) => {
  await tapHeaderAction('Done', "the output's Done")
  await expectScreen(`the ${tab} screen after Done`, CRYPTO_TABS[tab].route)
  await el(T.CRYPTO_OUTPUT).waitForExist({reverse: true, timeout: 5_000})
}

// How far into the field its first line of text is drawn, in points: the native multi-line field's
// top inset and half a line. A long press below the text opens no edit menu (seen live).
const FIRST_LINE = 20

// Pastes the pasteboard into the open operation's field as a person does: a long press on the field's
// first line opens its edit menu, and its Paste is pressed. The field sits inside the operation's
// tappable box, so it has no element of its own: the box is tapped to focus it, the field's own native
// view is measured in the app, and the press goes to its first line only when that lies inside the
// box's element and on screen. Bound: the box 1 and its tap 1, the measure 4, pasteFromMenu 18 = 24.
export const pasteIntoCryptoField = async (tab: CryptoTab) => {
  const box = await el(CRYPTO_TABS[tab].input).getElement()
  await box.click()
  const started = await jsEval<number>(`${fiberPrelude}
    const g = globalThis
    g.__e2eCryptoFieldFrame = undefined
    const hosts = []
    const stack = [e2eRootFiber()]
    while (stack.length) {
      const f = stack.pop()
      if (f.sibling) stack.push(f.sibling)
      if (f.child) stack.push(f.child)
      const p = f.memoizedProps
      if (f.tag === 5 && p && p.testID === ${JSON.stringify(T.CRYPTO_TEXT_INPUT)} && f.stateNode && f.stateNode.node) hosts.push(f)
    }
    if (hosts.length !== 1) return hosts.length
    g.nativeFabricUIManager.measureInWindow(hosts[0].stateNode.node, (x, y, width, height) => (g.__e2eCryptoFieldFrame = {height, width, x, y}))
    return 1
  `)
  if (started !== 1) throw new Error(`${started} native crypto text fields drawn, not one`)
  type Frame = {height: number; width: number; x: number; y: number}
  const frame = await waitFor(
    `the ${tab} field measured`,
    async () => (await jsEval<Frame | null>('return globalThis.__e2eCryptoFieldFrame || null')) ?? undefined,
    {interval: 100, timeout: 3_000}
  )
  const at = {x: frame.x + Math.min(40, frame.width / 2), y: frame.y + Math.min(FIRST_LINE, frame.height / 2)}
  const r = await box.getElementRect(box.elementId)
  const {height: window} = await browser.getWindowRect()
  if (frame.width <= 0 || frame.height <= 0 || at.x < r.x || at.x > r.x + r.width || at.y < r.y || at.y > r.y + r.height || at.y > window) {
    throw new Error(`the ${tab} field's first line is not inside its box on screen: ${JSON.stringify(frame)} in ${JSON.stringify(r)}`)
  }
  await pasteFromMenu(at, `the ${tab} field`)
}

// Whether the output modal renders `text` as its output. Its output is a selectable text, which
// XCUITest does not expose, so the comparison runs in the app over the modal's React tree (the texts
// under CRYPTO_OUTPUT); only the yes or no comes back, so no output ever leaves the app. Bound: 1.
export const cryptoOutputReads = async (text: string) =>
  jsEval<boolean>(`${fiberPrelude}
    const want = ${JSON.stringify(text)}
    const stack = [e2eRootFiber()]
    const outputs = []
    while (stack.length) {
      const f = stack.pop()
      if (f.sibling) stack.push(f.sibling)
      const p = f.memoizedProps
      if (p && p.testID === ${JSON.stringify(T.CRYPTO_OUTPUT)}) outputs.push(f)
      else if (f.child) stack.push(f.child)
    }
    if (outputs.length !== 1) return false
    const inner = outputs[0].child ? [outputs[0].child] : []
    while (inner.length) {
      const f = inner.pop()
      if (f.sibling) inner.push(f.sibling)
      if (f.child) inner.push(f.child)
      const p = f.memoizedProps
      if (p && p.children === want) return true
    }
    return false
  `)
