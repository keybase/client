import {activeDevices, deviceHistory} from '../../shared/devices.ts'
import {phoneDevice} from '../gate/accounts'
import {deviceListProblem, deviceRowsIn, paperKeyMasked, rowDevice} from '../gate/devices-lib'
import {step} from '../gate/step'
import {listedActiveDevices, openDevices} from '../helpers/devices'

// The Devices screen lists exactly the devices the service has active, by name, with the phone's own
// first as its current device. The phone shows no counts, so the whole list is read.
describe('devices view', () => {
  it('lists every active device the service has, the phone first as its current device', async function () {
    this.timeout(360_000)
    // a paper key's name is the first two words of its phrase: no message here names one
    const history = await deviceHistory()
    const masked = paperKeyMasked(history)
    const phone = await phoneDevice()
    await openDevices()
    const [first] = deviceRowsIn(await browser.getPageSource())
    const firstDevice = first ? rowDevice(first.label) : undefined
    if (firstDevice?.name !== phone.deviceName || !firstDevice.current || !firstDevice.active) {
      throw new Error(`the devices list does not start with the phone as its current device: it starts with ${firstDevice ? masked(firstDevice.name) : 'no device row'}`)
    }
    await step('The devices list starts with the phone, its current device', {card: true})

    const shown = await listedActiveDevices(masked)
    if (shown.current.length !== 1 || shown.current[0] !== phone.deviceName || shown.names[0] !== phone.deviceName) {
      throw new Error(`the list's current device is not the phone alone: it marks ${shown.current.map(masked).join(', ') || 'none'} current`)
    }
    const problem = deviceListProblem(shown.names, await activeDevices(), history)
    if (problem) throw new Error(problem)
    await step('The active devices end at the revoked section')
  })
})
