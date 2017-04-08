// @flow
import Render from '.'
import {isMobile} from '../../constants/platform'

import type {DumbComponentMap} from '../../constants/types/more'

const common = {
  created: 1444423192000,
  currentDevice: false,
  deviceID: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  icon: 'icon-computer-revoke-48',
  lastUsed: 1444423192001,
  name: 'Home Computer',
  onCancel: () => { console.log('device revoke on cancel') },
  onSubmit: () => { console.log('device revoke on submit') },
  provisionedAt: null,
  provisioner: null,
  revokedAt: null,
  type: 'desktop',
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
      device: common,
      endangeredTLFs: [],
      icon: 'icon-phone-revoke-48',
      type: 'mobile',
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
