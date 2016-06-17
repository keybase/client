// @flow
import Intro from './intro.render'
import type {DumbComponentMap} from '../../constants/types/more'

import type IntroProps from './intro'

const props: IntroProps = {
  onSignup: () => {},
  onLogin: () => {},
  justRevokedSelf: null,
}

export const dumbMap: DumbComponentMap<Intro> = {
  component: Intro,
  mocks: {
    'First time user': props,
    'User who just revoked device': Object.assign({}, props, {
      justRevokedSelf: 'DEVICE_NAME',
    }),
  },
}

export default {
  'Intro': dumbMap,
}
