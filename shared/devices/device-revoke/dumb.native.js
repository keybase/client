// @flow
import Render from './index.render'
import type {DumbComponentMap} from '../../constants/types/more'

const common = {
  type: 'desktop',
  name: 'Home Computer',
  isCurrent: false,
  onSubmit: () => { console.log('device revoke on submit') },
  onCancel: () => { console.log('device revoke on cancel') },
  parentProps: {
    style: {
      height: 667
    }
  }
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
      isCurrent: true
    }
  }
}

export default {
  'Device Revoke': map
}
