/* @flow */
import Devices from './render'
import type {Device} from '../constants/types/more'

const dev1: Device = {
  name: 'Paper Key (lorem ipsum...)',
  deviceID: '3d2e716574f68fb4eb5b56a5ec8eeeee',
  type: 'backup',
  created: 1444423192000,
  currentDevice: false,
  provisioner: null,
  provisionedAt: 1444423192000,
  revokedAt: null,
  lastUsed: 1444423192001,
}

const dev2: Device = {
  name: 'My Desktop',
  deviceID: '7289c92083fc6a2b6d46e26212e00000',
  type: 'desktop',
  created: 1444423193000,
  currentDevice: true,
  provisioner: null,
  provisionedAt: 1444423193000,
  revokedAt: null,
  lastUsed: 1444423193001,
}

const dev3: Device = {
  name: 'My Phone',
  deviceID: '729cb1b72ebadafee219759c33399999',
  type: 'mobile',
  created: 1450305567000,
  currentDevice: false,
  provisioner: null,
  provisionedAt: 1450305567000,
  revokedAt: null,
  lastUsed: 1450305567000,
}

const rev1: Device = {
  ...dev1,
  name: 'Paper Key (revo ked...)',
  revokedAt: 1444423192000,
}

const rev2: Device = {
  ...dev2,
  name: 'My Revoked Desktop',
  currentDevice: false,
  revokedAt: 1444423193000,
}

const rev3: Device = {
  ...dev3,
  name: 'My Revoked Phone',
  revokedAt: 1444423193000,
}

const devices: Array<Device> = [
  dev1, dev2, dev3,
]

const revokedDevices: Array<Device> = [
  rev1, rev2, rev3,
]

export default {
  'Devices List': {
    component: Devices,
    mocks: {
      'Devices': {devices, revokedDevices},
    },
  },
}
