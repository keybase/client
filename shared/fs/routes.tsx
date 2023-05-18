import type * as Container from '../util/container'
import fsRoot from './page'
import barePreview from './filepreview/page'
import confirmDelete from './common/path-item-action/confirm-delete/page'
import destinationPicker from './browser/destination-picker/page'
import kextPermission from './banner/system-file-manager-integration-banner/page'

export const newRoutes = {
  fsRoot,
}

export const newModalRoutes = {
  barePreview,
  confirmDelete,
  destinationPicker,
  kextPermission,
}

export type RootParamListFS = Container.PagesToParams<typeof newRoutes & typeof newModalRoutes>
