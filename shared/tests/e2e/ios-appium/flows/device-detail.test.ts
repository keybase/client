import * as T from '../../shared/test-ids'
import {phoneDevice} from '../gate/accounts'
import {step} from '../gate/step'
import {labeled, openDevicePage, openDevices} from '../helpers/devices'
import {el} from '../helpers/elements'

// The phone's own device's page, opened from its row by name. Its revoke button is never tapped:
// revoking the current device deprovisions the phone.
describe('device detail', () => {
  it("shows the phone's own device as the current device, with its timeline", async () => {
    const phone = await phoneDevice()
    await openDevices()
    await openDevicePage(phone.deviceName)
    await labeled('StaticText', 'Current device').waitForExist({timeout: 10_000})
    await labeled('StaticText', 'Device').waitForExist({timeout: 10_000})
    await el(T.DEVICE_PAGE_LAST_USED).waitForExist({timeout: 10_000})
    expect(await browser.$('-ios predicate string:type == "XCUIElementTypeStaticText" AND label BEGINSWITH "Added "').isExisting()).toBe(true)
    // the account has other devices, so the button is there and enabled; this flow leaves it alone
    expect(await labeled('Button', 'Revoke this device').isEnabled()).toBe(true)
    await step("The phone's device page: current device, last used and added", {card: true})
  })
})
