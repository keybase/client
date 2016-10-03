// @flow
import Intro from './intro.render'
import type {IntroProps} from './intro.render'
import type {DumbComponentMap} from '../../constants/types/more'

const props: IntroProps = {
  onSignup: () => {},
  onLogin: () => {},
  onRetry: () => {},
  justRevokedSelf: null,
  justDeletedSelf: null,
  justLoginFromRevokedDevice: null,
  bootStatus: 'bootStatusLoading',
}

const dumbMap: DumbComponentMap<Intro> = {
  component: Intro,
  mocks: {
    'Splash': props,
    'Failure': {...props, bootStatus: 'bootStatusFailure'},
    'First time user': {...props, bootStatus: 'bootStatusBootstrapped'},
    'User who just revoked device': {...props, bootStatus: 'bootStatusBootstrapped', justRevokedSelf: 'DEVICE_NAME'},
    'User who just deleted self': {...props, bootStatus: 'bootStatusBootstrapped', justDeletedSelf: 'hal9000'},
    'User who tried to login from revoked device': {...props, bootStatus: 'bootStatusBootstrapped', justLoginFromRevokedDevice: 'DEVICE_NAME'},
  },
}

export default {
  'Intro': dumbMap,
}

export {
  dumbMap,
}
