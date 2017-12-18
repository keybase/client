// @flow
import Render from '.'

import type {DumbComponentMap} from '../../constants/types/more'

const common = {
  currentDevice: false,
  deviceID: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  endangeredTLFs: [],
  icon: 'icon-computer-revoke-48',
  name: 'Home Computer',
  onCancel: () => console.log('device revoke on cancel'),
  onSubmit: () => console.log('device revoke on submit'),
}

const endangeredTLFs = [
  'private/you,user1',
  'private/you,user2',
  'private/you,user3',
  'public/you,user1',
  'public/you,user2',
  'public/you,user3',
]

// $FlowIssue
const map: DumbComponentMap<Render> = {
  component: Render,
  mocks: {
    Normal: {
      ...common,
      device: common,
      icon: 'icon-phone-revoke-48',
      type: 'mobile',
    },
    Current: {
      ...common,
      currentDevice: true,
    },
    'Normal with endangered TLFs': {
      ...common,
      endangeredTLFs,
    },
    'Current with endangered TLFs': {
      ...common,
      currentDevice: true,
      endangeredTLFs,
    },
  },
}

export default {
  'Devices: Device Revoke': map,
}
