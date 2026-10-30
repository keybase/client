import {evalInPage, inspectorPageFor} from '../../shared/metro-eval'
import {navigateToMore, navigateToPeople} from '../helpers/navigate'
import {beginErrorCapture, takeErrors} from '../gate/errors'
import {step} from '../gate/step'

describe('harness helpers', () => {
  it('opens Settings by the tab bar and comes back', async () => {
    await navigateToMore()
    await step('Opened the Settings tab', {card: true})
    await navigateToPeople()
    await step('Back on the People tab')
  })

  it('collects the app console errors and clears them', async () => {
    const marker = `harness-helpers console.error ${Date.now()}`
    await beginErrorCapture()
    await evalInPage(await inspectorPageFor(process.env['KB_IOS_DEVICE'] ?? 'iPhoneTest', 'keybase.ios'), `console.error(${JSON.stringify(marker)}); return null`)
    expect(await takeErrors()).toEqual([marker])
    expect(await takeErrors()).toEqual([])
  })
})
