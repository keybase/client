// @flow
// // TODO
/* eslint-env jest */
// import * as I from 'immutable'
import * as Types from '../../constants/types/devices'
// import * as Constants from '../../constants/devices'
import * as Tabs from '../../constants/tabs'
import * as DevicesGen from '../devices-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
// import * as Saga from '../../util/saga'
import * as RouteTree from '../route-tree'
import devicesSaga from '../devices'
import {createStore, applyMiddleware} from 'redux'
import rootReducer from '../../reducers'
import createSagaMiddleware from 'redux-saga'
import appRouteTree from '../../app/routes-app'
import {getPath as getRoutePath} from '../../route-tree'

// jest.mock('../../constants/types/rpc-gen.js')
jest.mock('../../engine')

// We want to be logged in usually
const _root = rootReducer(undefined, {type: 'MOCK'})
const _initialStore = {
  ..._root,
  config: _root.config.merge({
    loggedIn: true,
    username: 'username',
  }),
}

const startReduxSaga = (initialStore = _initialStore) => {
  const sagaMiddleware = createSagaMiddleware({
    onError: e => {
      throw e
    },
  })
  const store = createStore(rootReducer, initialStore, applyMiddleware(sagaMiddleware))
  const getState = store.getState
  const dispatch = store.dispatch
  sagaMiddleware.run(devicesSaga)

  dispatch(RouteTree.switchRouteDef(appRouteTree))
  dispatch(RouteTree.navigateTo([Tabs.devicesTab]))

  return {
    dispatch,
    getRoutePath: () => getRoutePath(getState().routeTree.routeState, [Tabs.loginTab]),
    getState,
  }
}

describe('reload works', () => {
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

  it('loads on revoked', () => {
    const {dispatch} = init
    expect(spy).not.toHaveBeenCalled()
    dispatch(
      DevicesGen.createRevoked({
        deviceID: Types.stringToDeviceID('132'),
        deviceName: 'a device',
        wasCurrentDevice: false,
      })
    )
    expect(spy).toHaveBeenCalled()
  })

  // it('loads on revoked', () => {
  // const {dispatch} = init
  // expect(RPCTypes.deviceDeviceHistoryListRpcPromise.mock.calls.length).toEqual(0)
  // dispatch(
  // )
  // expect(RPCTypes.deviceDeviceHistoryListRpcPromise.mock.calls.length).toEqual(1)
  // })
})
// describe('showRevokePageSideEffects', () => {
// it('Asks for endangered tlfs', () => {
// const deviceID = Types.stringToDeviceID('1234aaa')
// expect(_testing.requestEndangeredTLFsLoad(DevicesGen.createShowRevokePage({deviceID}))).toEqual(
// Saga.put(DevicesGen.createEndangeredTLFsLoad({deviceID}))
// )
// })
// })

// describe('convertDataFromServer', () => {
// const d1 = {
// cTime: 1234,
// deviceID: Types.stringToDeviceID('a1'),
// encryptKey: 'kid',
// lastUsedTime: 3456,
// mTime: 2345,
// name: 'a',
// status: 0,
// type: Types.stringToDeviceType('mobile'),
// verifyKey: 'vkey',
// }

// const d2 = {
// ...d1,
// deviceID: Types.stringToDeviceID('b'),
// name: 'b',
// type: Types.stringToDeviceType('desktop'),
// }

// const results: Array<RPCTypes.DeviceDetail> = [
// {
// currentDevice: false,
// device: d1,
// eldest: false,
// provisionedAt: 5677,
// provisioner: d2,
// revokedAt: 69236,
// revokedBy: 'rkey',
// revokedByDevice: d1,
// },
// {
// currentDevice: true,
// device: d2,
// eldest: false,
// provisionedAt: 5677,
// provisioner: d1,
// revokedAt: 69236,
// revokedBy: '',
// revokedByDevice: null,
// },
// ]

// const idToDetail: I.Map<Types.DeviceID, Types.DeviceDetail> = I.Map([
// [
// d1.deviceID,
// Constants.makeDeviceDetail({
// created: d1.cTime,
// currentDevice: false,
// deviceID: d1.deviceID,
// lastUsed: d1.lastUsedTime,
// name: d1.name,
// provisionedAt: 5677,
// provisionerName: d2.name,
// revokedAt: 69236,
// revokedByName: d1.name,
// type: 'mobile',
// }),
// ],
// [
// d2.deviceID,
// Constants.makeDeviceDetail({
// created: d2.cTime,
// currentDevice: true,
// deviceID: d2.deviceID,
// lastUsed: d2.lastUsedTime,
// name: d2.name,
// provisionedAt: 5677,
// provisionerName: d1.name,
// revokedAt: 69236,
// revokedByName: null,
// type: 'desktop',
// }),
// ],
// ])

// expect(_testing.dispatchDevicesLoaded(results)).toEqual(
// Saga.put(DevicesGen.createDevicesLoaded({idToDetail}))
// )
// })
