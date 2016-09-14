// @flow
import Intro from './intro.render'
import type {IntroProps} from './intro.render'
import type {DumbComponentMap} from '../../constants/types/more'

const props: IntroProps = {
  onSignup: () => {},
  onLogin: () => {},
  justRevokedSelf: null,
  justLoginFromRevokedDevice: null,
  loaded: false,
}

const dumbMap: DumbComponentMap<Intro> = {
  component: Intro,
  mocks: {
    'Splash': props,
    'First time user': {...props, loaded: true},
    'User who just revoked device': {...props, loaded: true, justRevokedSelf: 'DEVICE_NAME'},
    'User who tried to login from revoked device': {...props, loaded: true, justLoginFromRevokedDevice: 'DEVICE_NAME'},
  },
}

export default {
  'Intro': dumbMap,
}

export {
  dumbMap,
}
