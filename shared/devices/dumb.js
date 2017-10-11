// @flow
import Devices from './container'
import {List, Map} from 'immutable'
import {makeState as makeDeviceState, makeDeviceDetail} from '../constants/devices'
import {makeState as makeEntityState} from '../constants/entities'

const dev1 = makeDeviceDetail({
  created: 1444423192000,
  currentDevice: false,
  deviceID: '3d2e716574f68fb4eb5b56a5ec8eeeee',
  lastUsed: 1444423192001,
  name: 'Paper Key (lorem ipsum...)',
  provisionedAt: 1444423192000,
  provisioner: null,
  revokedAt: null,
  type: 'backup',
})

const dev2 = makeDeviceDetail({
  created: 1444423193000,
  currentDevice: true,
  deviceID: '7289c92083fc6a2b6d46e26212e00000',
  lastUsed: 1444423193001,
  name: 'My Desktop',
  provisionedAt: 1444423193000,
  provisioner: null,
  revokedAt: null,
  type: 'desktop',
})

const dev3 = makeDeviceDetail({
  created: 1450305567000,
  currentDevice: false,
  deviceID: '729cb1b72ebadafee219759c33399999',
  lastUsed: 1450305567000,
  name: 'My Phone',
  provisionedAt: 1450305567000,
  provisioner: null,
  revokedAt: null,
  type: 'mobile',
})

const rev1 = makeDeviceDetail({
  ...dev1.toJS(),
  deviceID: '4d2e716574f68fb4eb5b56a5ec8eeeee',
  name: 'Paper Key (revoked...)',
  revokedAt: 1444423192000,
})

const rev2 = makeDeviceDetail({
  ...dev2.toJS(),
  currentDevice: false,
  deviceID: '5d2e716574f68fb4eb5b56a5ec8eeeee',
  name: 'My Revoked Desktop',
  revokedAt: 1444423193000,
})

const rev3 = makeDeviceDetail({
  ...dev3.toJS(),
  deviceID: '6d2e716574f68fb4eb5b56a5ec8eeeee',
  name: 'My Revoked Phone',
  revokedAt: 1444423193000,
})

const devices = Map({
  [dev1.deviceID]: dev1,
  [dev2.deviceID]: dev2,
  [dev3.deviceID]: dev3,
  [rev1.deviceID]: rev1,
  [rev2.deviceID]: rev2,
  [rev3.deviceID]: rev3,
})

const mockStore = {
  config: {
    username: 'chris',
  },
  devices: makeDeviceState({
    deviceIDs: List(devices.keys()),
  }),
  entities: makeEntityState({
    devices,
  }),
}

export default {
  'Devices: Devices List': {
    component: Devices,
    mocks: {
      Devices: {mockStore, routeState: {showingRevoked: true}, setRouteState: () => {}},
    },
  },
}
