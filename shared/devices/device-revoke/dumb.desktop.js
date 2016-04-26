// @flow
import Render from './index.render.desktop'

const common = {
  type: 'desktop',
  name: 'Home Computer',
  isCurrent: false,
  onSubmit: () => { console.log('device revoke on submit') },
  onCancel: () => { console.log('device revoke on cancel') }
}

export default {
  'Device Revoke': {
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
}
