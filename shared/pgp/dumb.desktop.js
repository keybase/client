// @flow
import type {DumbComponentMap} from '../constants/types/more'
import PurgeMessage from './purge-message.desktop'

const dumbPurgeMessage: DumbComponentMap<PurgeMessage> = {
  component: PurgeMessage,
  mocks: {
    'Purge Message': {
      onClose: () => console.log('onClose'),
      onOk: () => console.log('onOk'),
    },
  },
}

export default {
  'PGP Purge Message': dumbPurgeMessage,
}
