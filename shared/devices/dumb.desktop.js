/* @flow */
import Devices from './index.render.desktop'
import type {Device} from '../constants/types/flow-types'

const dev1: Device = {
  cTime: 1444423192000,
  deviceID: '3d2e716574f68fb4eb5b56a5ec8eeeee',
  encryptKey: '',
  mTime: 1444423192000,
  name: 'Paper Key (lorem ipsum...)',
  status: 0,
  type: 'backup',
  verifyKey: ''
}

const dev2: Device = {
  cTime: 1444423193000,
  deviceID: '7289c92083fc6a2b6d46e26212e00000',
  encryptKey: '',
  mTime: 1444423194000,
  name: 'caius',
  status: 0,
  type: 'desktop',
  verifyKey: ''
}

const dev3: Device = {
  cTime: 1450305567000,
  deviceID: '729cb1b72ebadafee219759c33399999',
  encryptKey: '',
  mTime: 1450305567000,
  name: 'tenet',
  status: 0,
  type: 'mobile',
  verifyKey: ''
}

const devicesDefault: Array<Device> = [
  dev1,
  dev2,
  dev3
]

export default {
  'Devices List': {
    component: Devices,
    mocks: {
      'Devices': {devices: devicesDefault}
    }
  }
}
