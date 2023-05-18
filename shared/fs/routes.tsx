import type * as FSTypes from '../constants/types/fs'
import type {BarePreview} from './filepreview'
import type ConfirmDelete from './common/path-item-action/confirm-delete/container'
import type KextPermission from './banner/system-file-manager-integration-banner/kext-permission-popup-container'
import type DestinationPicker from './browser/destination-picker/container'

import fsRoot, {type RouteProps as FSRootProps} from './page'

export const newRoutes = {
  ...fsRoot,
}

export const newModalRoutes = {
  barePreview: {getScreen: () => require('./filepreview').BarePreview as typeof BarePreview},
  confirmDelete: {
    getScreen: () =>
      require('./common/path-item-action/confirm-delete/container').default as typeof ConfirmDelete,
  },
  destinationPicker: {
    getScreen: () => require('./browser/destination-picker/container').default as typeof DestinationPicker,
  },
  kextPermission: {
    getScreen: () =>
      require('./banner/system-file-manager-integration-banner/kext-permission-popup-container')
        .default as typeof KextPermission,
  },
}

export type RootParamListFS = {
  destinationPicker: {
    index: number
  }
  confirmDelete: {
    path: FSTypes.Path
    mode: 'row' | 'screen'
  }
  barePreview: {path: FSTypes.Path}
  kextPermission: undefined
} & FSRootProps
