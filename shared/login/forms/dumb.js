// @flow
import {Intro, Splash, Failure} from '.'

import type {DumbComponentMap} from '../../constants/types/more'
import type {Props} from '.'

const props: Props = {
  bootStatus: 'bootStatusLoading',
  justDeletedSelf: null,
  justLoginFromRevokedDevice: null,
  justRevokedSelf: null,
  onLogin: () => {},
  onRetry: () => {},
  onSignup: () => {},
  retrying: false,
}

const intro: DumbComponentMap<Intro> = {
  component: Intro,
  mocks: {
    'First time user': {...props, bootStatus: 'bootStatusBootstrapped'},
    'User who just revoked device': {...props, bootStatus: 'bootStatusBootstrapped', justRevokedSelf: 'DEVICE_NAME'},
    'User who just deleted self': {...props, bootStatus: 'bootStatusBootstrapped', justDeletedSelf: 'hal9000'},
    'User who tried to login from revoked device': {...props, bootStatus: 'bootStatusBootstrapped', justLoginFromRevokedDevice: 'DEVICE_NAME'},
  },
}
const splash: DumbComponentMap<Splash> = {
  component: Splash,
  mocks: {
    'Splash': props,
  },
}

const failure: DumbComponentMap<Failure> = {
  component: Failure,
  mocks: {
    'Failure': {...props, bootStatus: 'bootStatusFailure'},
  },
}

export default {
  'Login: Failure': failure,
  'Login: Intro': intro,
  'Login: Splash': splash,
}
