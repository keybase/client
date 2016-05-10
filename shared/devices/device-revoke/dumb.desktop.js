// @flow
import Render from './index.render'
import type {DumbComponentMap} from '../../constants/types/more'

const common = {
  type: 'desktop',
  name: 'Home Computer',
  deviceID: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  currentDevice: false,
  onSubmit: () => { console.log('device revoke on submit') },
  onCancel: () => { console.log('device revoke on cancel') }
}

const map: DumbComponentMap<Render> = {
  component: Render,
  mocks: {
    'Normal': {
      ...common,
      type: 'mobile'
    },
    'Current': {
      ...common,
      currentDevice: true,
    }
  }
}

export default {
  'Device Revoke': map
}
