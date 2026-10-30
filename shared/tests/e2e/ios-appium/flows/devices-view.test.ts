import {activeDevices} from '../../shared/devices.ts'
import {phoneDevice} from '../gate/accounts'
import {deviceRowsIn, rowDevice} from '../gate/devices-lib'
import {step} from '../gate/step'
import {listedActiveDevices, openDevices} from '../helpers/devices'

// The Devices screen lists exactly the devices the service has active, by name, with the phone's own
// first as its current device. The phone shows no counts, so the whole list is read.
describe('devices view', () => {
  it('lists every active device the service has, the phone first as its current device', async function () {
    this.timeout(360_000)
    const phone = await phoneDevice()
    await openDevices()
    const [first] = deviceRowsIn(await browser.getPageSource())
    expect(first && rowDevice(first.label)).toEqual({active: true, current: true, name: phone.deviceName})
    await step('The devices list starts with the phone, its current device', {card: true})

    const shown = await listedActiveDevices()
    expect(shown.current).toEqual([phone.deviceName])
    expect(shown.names[0]).toBe(phone.deviceName)
    const service = (await activeDevices()).map(d => d.name)
    expect([...shown.names].sort()).toEqual([...service].sort())
    await step('The active devices end at the revoked section')
  })
})
