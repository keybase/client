// @flow
import Intro from './intro.render'
import type {DumbComponentMap} from '../../constants/types/more'

import type IntroProps from './intro'

const props: IntroProps = {
  onSignup: () => {},
  onLogin: () => {},
  justRevokedSelf: null,
  loaded: false,
}

export const dumbMap: DumbComponentMap<Intro> = {
  component: Intro,
  mocks: {
    'Splash': props,
    'First time user': {...props, loaded: true},
    'User who just revoked device': {...props, loaded: true, justRevokedSelf: 'DEVICE_NAME'},
  },
}

export default {
  'Intro': dumbMap,
}
