// @flow
import type {DumbComponentMap} from '../constants/types/more'
import PurgeMessage from './index.desktop'

const dumbPurgeMessage: DumbComponentMap<PurgeMessage> = {
  component: PurgeMessage,
  mocks: {
    'Purge Message': {
      onClose: () => console.log('onClose'),
    },
  },
}

export default {
  'PGP Purge Message': dumbPurgeMessage,
}
