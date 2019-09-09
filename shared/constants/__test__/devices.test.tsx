/* eslint-env jest */
import {getDeviceIconNumberInner, makeDevice} from '../devices'
import {stringToDeviceID} from '../types/devices'

const idxToDeviceType = (idx: 0 | 1 | 2) => {
  switch (idx) {
    case 0:
      return 'desktop'
    case 1:
      return 'mobile'
  }
  return 'backup'
}

const devices = new Map(
  new Array(100).fill(null).map((_, idx) => [
    stringToDeviceID(String(idx)),
    // @ts-ignore
    makeDevice({created: idx, deviceID: stringToDeviceID(String(idx)), type: idxToDeviceType(idx % 3)}),
  ])
)

describe('device icons', () => {
  it('figures out what device icon to use', () => {
    devices.forEach((_, deviceID) => {
      expect(getDeviceIconNumberInner(devices, deviceID)).toBe(Math.floor(((Number(deviceID) / 3) % 10) + 1))
    })
  })
  it('returns -1 for unknown IDs', () => {
    expect(getDeviceIconNumberInner(devices, 'not an ID')).toBe(-1)
  })
})
