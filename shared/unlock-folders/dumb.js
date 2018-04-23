// @flow
import UnlockFolders from './index.desktop'
import type {DumbComponentMap} from '../constants/types/more'

const unlockFolderMap: DumbComponentMap<UnlockFolders> = {
  component: UnlockFolders,
  mocks: {
    Normal: {
      ...common,
    },
    'No paperkeys': {
      ...common,
      paperKeysHidden: true,
    },
    Single: {
      ...common,
      devices: [devices[0]],
    },
    'Paperkey input': {
      ...common,
      phase: 'paperKeyInput',
    },
    'Paperkey error': {
      ...common,
      phase: 'paperKeyInput',
      paperkeyError: 'Invalid paperkey',
    },
    'Paperkey error waiting': {
      ...common,
      phase: 'paperKeyInput',
      paperkeyError: 'Invalid paperkey',
      waiting: true,
    },
    Success: {
      ...common,
      phase: 'success',
      waiting: false,
    },
  },
}

export default {
  'unlock folders': unlockFolderMap,
}
