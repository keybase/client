// @flow
/* eslint-env jest */
import * as I from 'immutable'
import * as Types from '../../constants/types/devices'
import * as Constants from '../../constants/devices'
import * as Tabs from '../../constants/tabs'
import * as DevicesGen from '../devices-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as RouteTree from '../route-tree'
import devicesSaga from '../devices'
import appRouteTree from '../../app/routes-app'
import * as Testing from '../../util/testing'

jest.mock('../../engine')

// We want to be logged in usually
const blankStore = Testing.getInitialStore()
const initialStore = {
  ...blankStore,
  config: blankStore.config.merge({
    loggedIn: true,
    username: 'username',
  }),
}

const loadedStore = {
  ...initialStore,
  devices: initialStore.devices.merge({
    deviceMap: I.Map([
      [
        Types.stringToDeviceID('123'),
        Constants.makeDevice({
          created: 0,
          currentDevice: true,
          deviceID: Types.stringToDeviceID('123'),
          lastUsed: 4567,
          name: 'a computer',
          provisionedAt: 0,
          provisionerName: '',
          revokedAt: null,
          revokedByName: null,
          type: 'desktop',
        }),
      ],
      [
        Types.stringToDeviceID('456'),
        Constants.makeDevice({
          created: 0,
          currentDevice: false,
          deviceID: Types.stringToDeviceID('456'),
          lastUsed: 4567,
          name: 'a phone',
          provisionedAt: 0,
          provisionerName: '',
          revokedAt: null,
          revokedByName: null,
          type: 'mobile',
        }),
      ],
      [
        Types.stringToDeviceID('789'),
        Constants.makeDevice({
          created: 0,
          currentDevice: false,
          deviceID: Types.stringToDeviceID('789'),
          lastUsed: 4567,
          name: 'paper key',
          provisionedAt: 0,
          provisionerName: '',
          revokedAt: null,
          revokedByName: null,
          type: 'backup',
        }),
      ],
    ]),
  }),
}

const startOnDevicesTab = dispatch => {
  dispatch(RouteTree.switchRouteDef(appRouteTree))
  dispatch(RouteTree.navigateTo([Tabs.devicesTab]))
}

const startReduxSaga = Testing.makeStartReduxSaga(devicesSaga, initialStore, startOnDevicesTab)

// const getRoutePath: (getState) => getRoutePath(getState().routeTree.routeState, [Tabs.loginTab])

describe('reload side effects', () => {
  let init
  let spy
  beforeEach(() => {
    init = startReduxSaga()
    spy = jest.spyOn(RPCTypes, 'deviceDeviceHistoryListRpcPromise')
  })
  afterEach(() => {
    spy.mockRestore()
  })

  it('loads on load', () => {
    const {dispatch} = init
    expect(spy).not.toHaveBeenCalled()
    dispatch(DevicesGen.createLoad())
    expect(spy).toHaveBeenCalled()
  })

  it("doesn't load on logged out", () => {
    init = startReduxSaga(blankStore) // logged out store
    const {dispatch} = init
    dispatch(DevicesGen.createLoad())
    expect(spy).not.toHaveBeenCalled()
  })

  it('loads on revoked', () => {
    const {dispatch} = init
    dispatch(
      DevicesGen.createRevoked({
        deviceID: Types.stringToDeviceID('132'),
        deviceName: 'a device',
        wasCurrentDevice: false,
      })
    )
    expect(spy).toHaveBeenCalled()
  })
})

const details = [
  {
    currentDevice: true,
    device: {
      ctime: 1234,
      deviceID: '123',
      encryptKey: 0,
      lastUsedTime: 4567,
      mTime: 2345,
      name: 'a computer',
      status: 0,
      type: 'desktop',
      verifyKey: 0,
    },
    eldest: false,
  },
  {
    currentDevice: false,
    device: {
      ctime: 1234,
      deviceID: '456',
      encryptKey: 0,
      lastUsedTime: 4567,
      mTime: 2345,
      name: 'a phone',
      status: 0,
      type: 'mobile',
      verifyKey: 0,
    },
    eldest: false,
  },
  {
    currentDevice: false,
    device: {
      ctime: 1234,
      deviceID: '789',
      encryptKey: 0,
      lastUsedTime: 4567,
      mTime: 2345,
      name: 'paper key',
      status: 0,
      type: 'backup',
      verifyKey: 0,
    },
    eldest: false,
  },
]

describe('load', () => {
  let init
  beforeEach(() => {
    init = startReduxSaga()
  })
  afterEach(() => {})

  it('load leads to loaded', () => {
    const {dispatch, getState} = init
    const rpc = jest.spyOn(RPCTypes, 'deviceDeviceHistoryListRpcPromise')
    rpc.mockImplementation(() => new Promise(resolve => resolve(details)))

    dispatch(DevicesGen.createLoad())
    return Testing.flushPromises().then(() => {
      expect(getState().devices.deviceMap).toEqual(loadedStore.devices.deviceMap)
      expect(rpc).toHaveBeenCalled()
      rpc.mockRestore()
    })
  })
})

describe('revoking other', () => {
  let init
  beforeEach(() => {
    init = Testing.makeStartReduxSaga(devicesSaga, loadedStore, startOnDevicesTab)()
  })
  afterEach(() => {})

  it('works', () => {
    const {dispatch, getState} = init
    const rpc = jest.spyOn(RPCTypes, 'revokeRevokeDeviceRpcPromise')
    rpc.mockImplementation(() => new Promise(resolve => resolve()))

    const deviceID = Types.stringToDeviceID('456')

    expect(getState().devices.deviceMap.get(deviceID)).toBeTruthy()
    dispatch(DevicesGen.createRevoke({deviceID}))
    expect(rpc).toHaveBeenCalledWith({deviceID, forceLast: false, forceSelf: false}, Constants.waitingKey)
  })
})

// describe('revoking self', () => {
// TODO
// return RPCTypes.loginDeprovisionRpcPromise({doRevoke: true, username}, Constants.waitingKey).then(() =>
// DevicesGen.createRevoked({deviceID, deviceName, wasCurrentDevice})
// )
// })

// it('works', () => {
// const {dispatch} = init
// dispatch(DevicesGen.createRevoked({
// deviceID: Types.stringToDeviceID('132'),
// deviceName: 'a device',
// wasCurrentDevice: false,
// }))
// expect(spy).not.toHaveBeenCalled()
// })
// })
