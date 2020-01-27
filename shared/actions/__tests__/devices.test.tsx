/* eslint-env jest */
import * as Constants from '../../constants/devices'
import * as Container from '../../util/container'
import * as DevicesGen from '../devices-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as RouteTreeGen from '../route-tree-gen'
import * as Tabs from '../../constants/tabs'
import * as Testing from '../../util/testing'
import * as Types from '../../constants/types/devices'
import devicesSaga from '../devices'

jest.mock('../../engine/require')

// We want to be logged in usually
const blankStore = Testing.getInitialStore()
const initialStore = {
  ...blankStore,
  config: {...blankStore.config, deviceID: '999', loggedIn: true, username: 'username'},
}

const loadedStore = Container.produce(initialStore, draftState => {
  const deviceMap = new Map<string, Types.Device>()

  deviceMap.set(
    Types.stringToDeviceID('123'),
    Constants.makeDevice({
      created: 1234,
      currentDevice: true,
      deviceID: Types.stringToDeviceID('123'),
      lastUsed: 4567,
      name: 'a computer',
      provisionedAt: undefined,
      provisionerName: undefined,
      revokedAt: undefined,
      revokedByName: undefined,
      type: 'desktop',
    })
  )

  deviceMap.set(
    Types.stringToDeviceID('456'),
    Constants.makeDevice({
      created: 1234,
      currentDevice: false,
      deviceID: Types.stringToDeviceID('456'),
      lastUsed: 4567,
      name: 'a phone',
      provisionedAt: undefined,
      provisionerName: undefined,
      revokedAt: undefined,
      revokedByName: undefined,
      type: 'mobile',
    })
  )

  deviceMap.set(
    Types.stringToDeviceID('789'),
    Constants.makeDevice({
      created: 1234,
      currentDevice: false,
      deviceID: Types.stringToDeviceID('789'),
      lastUsed: 4567,
      name: 'paper key',
      provisionedAt: undefined,
      provisionerName: undefined,
      revokedAt: undefined,
      revokedByName: undefined,
      type: 'backup',
    })
  )
  draftState.devices.deviceMap = deviceMap
})

const details = [
  {
    currentDevice: true,
    device: {
      cTime: 1234,
      deviceID: '123',
      deviceNumberOfType: 0,
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
      cTime: 1234,
      deviceID: '456',
      deviceNumberOfType: 0,
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
      cTime: 1234,
      deviceID: '789',
      deviceNumberOfType: 0,
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

const startOnDevicesTab = (dispatch: Container.Dispatch) => {
  dispatch(RouteTreeGen.createSwitchLoggedIn({loggedIn: true}))
  dispatch(RouteTreeGen.createNavigateAppend({path: [Tabs.devicesTab]}))
}

const expectNavWithDeviceID = (deviceID: string) => {
  const navAppend = jest.spyOn(RouteTreeGen, 'createNavigateAppend')
  const assertNavHasDeviceID = () =>
    expect(navAppend).toHaveBeenCalledWith(
      expect.objectContaining({
        path: expect.arrayContaining([expect.objectContaining({props: expect.objectContaining({deviceID})})]),
      })
    )
  return {assertNavHasDeviceID}
}

const startReduxSaga = Testing.makeStartReduxSaga(devicesSaga, initialStore, startOnDevicesTab)

// const getRoute = getState => getRoutePath(getState().routeTree.routeState, [Tabs.devicesTab])

describe('reload side effects', () => {
  let init: any
  let rpc: any
  beforeEach(() => {
    init = startReduxSaga()
    rpc = jest.spyOn(RPCTypes, 'deviceDeviceHistoryListRpcPromise')
  })
  afterEach(() => {
    rpc && rpc.mockRestore()
  })

  it('loads on load', () => {
    const {dispatch} = init
    expect(rpc).not.toHaveBeenCalled()
    dispatch(DevicesGen.createLoad())
    expect(rpc).toHaveBeenCalled()
  })

  it("doesn't load on logged out", () => {
    init = startReduxSaga(blankStore) // logged out store
    const {dispatch} = init
    dispatch(DevicesGen.createLoad())
    expect(rpc).not.toHaveBeenCalled()
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
    expect(rpc).toHaveBeenCalled()
  })
})

describe('load', () => {
  let init: any
  let rpc: any
  beforeEach(() => {
    init = startReduxSaga()
  })
  afterEach(() => {
    rpc && rpc.mockRestore()
  })

  it('load leads to loaded', () => {
    const {dispatch, getState} = init
    rpc = jest.spyOn(RPCTypes, 'deviceDeviceHistoryListRpcPromise')
    rpc.mockImplementation(() => Promise.resolve(details))

    dispatch(DevicesGen.createLoad())
    return Testing.flushPromises().then(() => {
      expect(getState().devices.deviceMap).toEqual(loadedStore.devices.deviceMap)
      expect(rpc).toHaveBeenCalled()
    })
  })

  it('loaded handles null', () => {
    const {dispatch, getState} = init
    rpc = jest.spyOn(RPCTypes, 'deviceDeviceHistoryListRpcPromise')
    rpc.mockImplementation(() => Promise.resolve())
    dispatch(DevicesGen.createLoad())
    return Testing.flushPromises().then(() => {
      expect(getState().devices.deviceMap).toEqual(new Map())
      expect(rpc).toHaveBeenCalled()
    })
  })
})

describe('revoking other', () => {
  let init: any
  let rpc: any
  beforeEach(() => {
    init = Testing.makeStartReduxSaga(devicesSaga, loadedStore, startOnDevicesTab)()
  })
  afterEach(() => {
    rpc && rpc.mockRestore()
  })

  it('works', () => {
    const {dispatch, getState} = init
    rpc = jest.spyOn(RPCTypes, 'revokeRevokeDeviceRpcPromise')
    rpc.mockImplementation(() => Promise.resolve())

    const deviceID = Types.stringToDeviceID('456')

    expect(getState().devices.deviceMap.get(deviceID)).toBeTruthy()
    dispatch(DevicesGen.createRevoke({deviceID}))
    expect(rpc).toHaveBeenCalledWith({deviceID, forceLast: false, forceSelf: false}, Constants.waitingKey)
  })
})

describe('revoking self', () => {
  let init: any
  let rpc: any
  beforeEach(() => {
    init = Testing.makeStartReduxSaga(devicesSaga, loadedStore, startOnDevicesTab)()
  })
  afterEach(() => {
    rpc && rpc.mockRestore()
  })

  it('works', () => {
    const {dispatch, getState} = init
    rpc = jest.spyOn(RPCTypes, 'loginDeprovisionRpcPromise')
    rpc.mockImplementation(() => Promise.resolve())

    const deviceID = Types.stringToDeviceID('123')

    expect(getState().devices.deviceMap.get(deviceID)).toBeTruthy()
    dispatch(DevicesGen.createRevoke({deviceID}))
    expect(rpc).toHaveBeenCalledWith(
      {doRevoke: true, username: loadedStore.config.username},
      Constants.waitingKey
    )
  })
})

describe('navs after revoking', () => {
  let init: any
  beforeEach(() => {
    init = Testing.makeStartReduxSaga(devicesSaga, loadedStore, startOnDevicesTab)()
  })
  afterEach(() => {})

  it('root of devices on revoke other', () => {
    const {dispatch} = init
    const deviceID = Types.stringToDeviceID('456')
    dispatch(DevicesGen.createRevoked({deviceID, deviceName: 'a phone', wasCurrentDevice: false}))
    // expect(getRoute(getState)).toEqual(I.List([Tabs.devicesTab]))
  })

  it('root of login on revoke self', () => {
    const {dispatch} = init
    const deviceID = Types.stringToDeviceID('456')
    dispatch(DevicesGen.createRevoked({deviceID, deviceName: 'a phone', wasCurrentDevice: true}))
    // expect(getRoutePath(getState().routeTree.routeState, [Tabs.loginTab])).toEqual(I.List([]))
  })
})

describe('shows revoke page correctly', () => {
  let init: any
  let rpc: any
  beforeEach(() => {
    init = Testing.makeStartReduxSaga(devicesSaga, loadedStore, startOnDevicesTab)()
  })
  afterEach(() => {
    rpc && rpc.mockRestore()
  })

  it('shows revoke page', () => {
    const {dispatch} = init
    const deviceID = Types.stringToDeviceID('456')
    const {assertNavHasDeviceID} = expectNavWithDeviceID(deviceID)
    dispatch(DevicesGen.createShowRevokePage({deviceID}))
    assertNavHasDeviceID()
  })

  it('requests endangered', () => {
    const {dispatch, getState} = init
    const deviceID = Types.stringToDeviceID('456')
    rpc = jest.spyOn(RPCTypes, 'rekeyGetRevokeWarningRpcPromise')
    rpc.mockImplementation(() => Promise.resolve({}))
    dispatch(DevicesGen.createShowRevokePage({deviceID}))
    const targetDevice = deviceID
    const actingDevice = getState().config.deviceID
    expect(rpc).toHaveBeenCalledWith({actingDevice, targetDevice}, Constants.waitingKey)
  })

  it('loads null endangered', () => {
    const {dispatch, getState} = init
    const deviceID = Types.stringToDeviceID('456')
    rpc = jest.spyOn(RPCTypes, 'rekeyGetRevokeWarningRpcPromise')
    rpc.mockImplementation(() => Promise.resolve({}))
    dispatch(DevicesGen.createShowRevokePage({deviceID}))
    return Testing.flushPromises().then(() => {
      expect(getState().devices.endangeredTLFMap.get(deviceID)).toEqual(new Set())
    })
  })

  it('loads good endangered', () => {
    const {dispatch, getState} = init
    const deviceID = Types.stringToDeviceID('456')
    rpc = jest.spyOn(RPCTypes, 'rekeyGetRevokeWarningRpcPromise')
    rpc.mockImplementation(() => Promise.resolve({endangeredTLFs: [{name: 'one'}, {name: 'two'}]}))
    dispatch(DevicesGen.createShowRevokePage({deviceID}))
    return Testing.flushPromises().then(() => {
      expect(getState().devices.endangeredTLFMap.get(deviceID)).toEqual(new Set(['one', 'two']))
    })
  })
})

describe('shows device page correctly', () => {
  let init: any
  beforeEach(() => {
    init = Testing.makeStartReduxSaga(devicesSaga, loadedStore, startOnDevicesTab)()
  })
  afterEach(() => {})

  it('shows device page', () => {
    const {dispatch} = init
    const deviceID = Types.stringToDeviceID('789')
    const {assertNavHasDeviceID} = expectNavWithDeviceID(deviceID)
    dispatch(DevicesGen.createShowDevicePage({deviceID}))
    assertNavHasDeviceID()
  })
})

describe('shows paperkey page correctly', () => {
  let init: any
  let rpc: any
  beforeEach(() => {
    init = Testing.makeStartReduxSaga(devicesSaga, loadedStore, startOnDevicesTab)()
  })
  afterEach(() => {
    rpc && rpc.mockRestore()
  })

  it('shows paperkey page', () => {
    const {dispatch} = init
    const navAppend = jest.spyOn(RouteTreeGen, 'createNavigateAppend')
    dispatch(DevicesGen.createShowPaperKeyPage())
    expect(navAppend).toHaveBeenCalled()
  })

  it('creates a paperkey', () => {
    const {dispatch} = init
    rpc = jest.spyOn(RPCTypes, 'loginPaperKeyRpcSaga')
    rpc.mockImplementation(() => Promise.resolve())
    dispatch(DevicesGen.createShowPaperKeyPage())
    expect(rpc).toHaveBeenCalled()
  })

  it('paperkey gets loaded', () => {
    const {dispatch, getState} = init
    const paperKey = new Container.HiddenString('a paper key')
    expect(getState().devices.newPaperkey).toEqual(new Container.HiddenString(''))
    dispatch(DevicesGen.createPaperKeyCreated({paperKey}))
    expect(getState().devices.newPaperkey).toEqual(paperKey)
  })
})
