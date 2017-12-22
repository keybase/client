// @flow
/* eslint-env jest */
import * as I from 'immutable'
import * as Types from '../../constants/types/devices'
import * as Constants from '../../constants/devices'
import * as DevicesGen from '../devices-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Saga from '../../util/saga'
import * as WaitingGen from '../waiting-gen'
import HiddenString from '../../util/hidden-string'
import {_testing} from '../devices'

jest.unmock('immutable')

describe('showRevokePageSideEffects', () => {
  it('Asks for endangered tlfs', () => {
    const deviceID = Types.stringToDeviceID('1234aaa')
    expect(_testing.requestEndangeredTLFsLoad(DevicesGen.createShowRevokePage({deviceID}))).toEqual(
      Saga.put(DevicesGen.createEndangeredTLFsLoad({deviceID}))
    )
  })
})

describe('convertDataFromServer', () => {
  const d1 = {
    cTime: 1234,
    deviceID: Types.stringToDeviceID('a1'),
    encryptKey: 'kid',
    lastUsedTime: 3456,
    mTime: 2345,
    name: 'a',
    status: 0,
    type: Types.stringToDeviceType('mobile'),
    verifyKey: 'vkey',
  }

  const d2 = {
    ...d1,
    deviceID: Types.stringToDeviceID('b'),
    name: 'b',
    type: Types.stringToDeviceType('desktop'),
  }

  const results: Array<RPCTypes.DeviceDetail> = [
    {
      currentDevice: false,
      device: d1,
      eldest: false,
      provisionedAt: 5677,
      provisioner: d2,
      revokedAt: 69236,
      revokedBy: 'rkey',
      revokedByDevice: d1,
    },
    {
      currentDevice: true,
      device: d2,
      eldest: false,
      provisionedAt: 5677,
      provisioner: d1,
      revokedAt: 69236,
      revokedBy: '',
      revokedByDevice: null,
    },
  ]

  const idToDetail: I.Map<Types.DeviceID, Types.DeviceDetail> = I.Map([
    [
      d1.deviceID,
      Constants.makeDeviceDetail({
        created: d1.cTime,
        currentDevice: false,
        deviceID: d1.deviceID,
        lastUsed: d1.lastUsedTime,
        name: d1.name,
        provisionedAt: 5677,
        provisionerName: d2.name,
        revokedAt: 69236,
        revokedByName: d1.name,
        type: 'mobile',
      }),
    ],
    [
      d2.deviceID,
      Constants.makeDeviceDetail({
        created: d2.cTime,
        currentDevice: true,
        deviceID: d2.deviceID,
        lastUsed: d2.lastUsedTime,
        name: d2.name,
        provisionedAt: 5677,
        provisionerName: d1.name,
        revokedAt: 69236,
        revokedByName: null,
        type: 'desktop',
      }),
    ],
  ])

  expect(_testing.dispatchDevicesLoaded(results)).toEqual(
    Saga.put(DevicesGen.createDevicesLoaded({idToDetail}))
  )
})

describe('waitingGetsUpdated', () => {
  const payload = {key: Constants.waitingKey}
  const deviceID = Types.stringToDeviceID('')

  it('waiting increments', () => {
    const actionsThatIncrement = [
      DevicesGen.createDeviceRevoke({deviceID}),
      DevicesGen.createDevicesLoad(),
      DevicesGen.createEndangeredTLFsLoad({deviceID}),
      DevicesGen.createPaperKeyMake(),
    ]

    actionsThatIncrement.forEach(a =>
      expect(_testing.changeWaiting(a)).toEqual(Saga.put(WaitingGen.createIncrementWaiting(payload)))
    )
  })

  it('waiting decrements', () => {
    const actionsThatDecrement = [
      DevicesGen.createDevicesLoaded({idToDetail: I.Map()}),
      DevicesGen.createEndangeredTLFsLoaded({deviceID, tlfs: []}),
      DevicesGen.createPaperKeyCreated({paperKey: new HiddenString('')}),
      DevicesGen.createDeviceRevoked({
        deviceID,
        deviceName: '',
        wasCurrentDevice: false,
      }),
    ]

    actionsThatDecrement.forEach(a =>
      expect(_testing.changeWaiting(a)).toEqual(Saga.put(WaitingGen.createDecrementWaiting(payload)))
    )
  })
})
