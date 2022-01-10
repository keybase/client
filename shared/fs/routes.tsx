import type FsRoot from './container'
import type {BarePreview} from './filepreview'
import type ConfirmDelete from './common/path-item-action/confirm-delete/container'
import type KextPermission from './banner/system-file-manager-integration-banner/kext-permission-popup-container'
import type DestinationPicker from './browser/destination-picker/container'

const fsRoot = {getScreen: (): typeof FsRoot => require('./container').default}

export const newRoutes = {fsRoot}

export const newModalRoutes = {
  barePreview: {getScreen: (): typeof BarePreview => require('./filepreview').BarePreview},
  confirmDelete: {
    getScreen: (): typeof ConfirmDelete =>
      require('./common/path-item-action/confirm-delete/container').default,
  },
  destinationPicker: {
    getScreen: (): typeof DestinationPicker => require('./browser/destination-picker/container').default,
  },
  kextPermission: {
    getScreen: (): typeof KextPermission =>
      require('./banner/system-file-manager-integration-banner/kext-permission-popup-container').default,
  },
}
