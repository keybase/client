// Sends W3C pointer actions as window-relative XCUITest gestures on a run that reads frames
// (gate/window-gestures-lib.ts says why and how they are read).
import {windowId} from '../helpers/elements'
import {type ActionSource, originElements, windowGestures} from './window-gestures-lib.ts'

type PerformActions = (actions: Array<ActionSource>) => Promise<void>

const sendGestures = async (orig: PerformActions, sources: Array<ActionSource>) => {
  const middles = new Map<string, {x: number; y: number}>()
  for (const id of originElements(sources)) {
    const r = await browser.getElementRect(id)
    middles.set(id, {x: r.x + r.width / 2, y: r.y + r.height / 2})
  }
  let gestures: ReturnType<typeof windowGestures>
  try {
    gestures = windowGestures(sources, middles)
  } catch {
    gestures = undefined
  }
  if (!gestures) return orig(sources)
  const elementId = await windowId()
  const r = Math.round
  for (const g of gestures) {
    if (g.kind === 'tap') await browser.execute('mobile: tap', {elementId, x: r(g.at.x), y: r(g.at.y)})
    else if (g.kind === 'hold') await browser.execute('mobile: touchAndHold', {duration: g.seconds, elementId, x: r(g.at.x), y: r(g.at.y)})
    else
      await browser.execute('mobile: dragFromToForDuration', {
        duration: g.press,
        elementId,
        fromX: r(g.from.x),
        fromY: r(g.from.y),
        toX: r(g.to.x),
        toY: r(g.to.y),
      })
  }
  return undefined
}

// An element's click as a tap at its middle, given relative to itself: XCUITest's own click misses
// some controls there (an inbox tab, a suggestion row, an edit's Cancel). An element not found goes to
// the click itself, which waits for it and throws as it does.
async function tapElementMiddle(this: WebdriverIO.Element, click: () => Promise<void>) {
  if (!this.elementId) return click()
  const r = await browser.getElementRect(this.elementId)
  await browser.execute('mobile: tap', {elementId: this.elementId, x: Math.round(r.width / 2), y: Math.round(r.height / 2)})
}

// From now on in this session, an element's click is tapElementMiddle.
export const sendClicksAsElementTaps = () => {
  const overwrite = browser.overwriteCommand.bind(browser) as unknown as (
    name: string,
    fn: (this: WebdriverIO.Element, click: () => Promise<void>) => Promise<void>,
    options: {attachToElement: boolean}
  ) => void
  overwrite('click', tapElementMiddle, {attachToElement: true})
}

// From now on in this session, performActions sends one pointer's actions as window gestures.
export const sendPointerActionsAsWindowGestures = () => {
  const overwrite = browser.overwriteCommand.bind(browser) as unknown as (
    name: string,
    fn: (orig: PerformActions, actions: Array<ActionSource>) => Promise<void>
  ) => void
  overwrite('performActions', sendGestures)
}
