// @flow
import Render from './index.render'
import type {DumbComponentMap} from '../../constants/types/more'

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
  parentProps: {
    style: {
      height: 667,
    },
  },
}

const map: DumbComponentMap<Render> = {
  component: Render,
  mocks: {
    'Normal': {
      ...common,
      type: 'mobile',
      device: common,
    },
    'Current': {
      ...common,
      currentDevice: true,
      device: common,
    },
  },
}

export default {
  'Device Revoke': map,
}
