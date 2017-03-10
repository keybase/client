// @flow
import Render from '.'
import {isMobile} from '../../constants/platform'

import type {DumbComponentMap} from '../../constants/types/more'

const parent = isMobile ? {
  parentProps: {
    style: {
      height: 667,
    },
  },
} : {}

const common = {
  type: 'desktop',
  name: 'Home Computer',
  deviceID: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  created: 1444423192000,
  provisioner: null,
  provisionedAt: null,
  revokedAt: null,
  currentDevice: false,
  lastUsed: 1444423192001,
  onSubmit: () => { console.log('device revoke on submit') },
  onCancel: () => { console.log('device revoke on cancel') },
  ...parent,
}

const endangeredTLFs = [
  {name: 'private/you,user1'},
  {name: 'private/you,user2'},
  {name: 'private/you,user3'},
  {name: 'public/you,user1'},
  {name: 'public/you,user2'},
  {name: 'public/you,user3'},
]

const map: DumbComponentMap<Render> = {
  component: Render,
  mocks: {
    'Normal': {
      ...common,
      type: 'mobile',
      device: common,
      endangeredTLFs: [],
    },
    'Current': {
      ...common,
      currentDevice: true,
      device: common,
      endangeredTLFs: [],
    },
    'Normal with endangered TLFs': {
      ...common,
      device: common,
      endangeredTLFs,
    },
    'Current with endangered TLFs': {
      ...common,
      currentDevice: true,
      device: common,
      endangeredTLFs,
    },
  },
}

export default {
  'Device Revoke': map,
}
