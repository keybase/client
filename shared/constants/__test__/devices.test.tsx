/* eslint-env jest */
import {getDeviceIconNumber, makeDevice} from '../devices'
import {stringToDeviceID} from '../types/devices'

const devices = new Map(
  new Array(100)
    .fill(null)
    .map((_, idx) => [
      stringToDeviceID(String(idx)),
      makeDevice({created: idx, deviceID: stringToDeviceID(String(idx))}),
    ])
)

describe('device icons', () => {
  it('figures out what device icon to use', () => {
    devices.forEach((_, deviceID) => {
      expect(getDeviceIconNumber(devices, deviceID)).toBe((Number(deviceID) % 10) + 1)
    })
  })
})
