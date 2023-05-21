import type * as Container from '../util/container'
import {newRoutes as provisionNewRoutes} from '../provision/routes-sub'

import devicePage from './device-page.page'
import deviceRevoke from './device-revoke.page'
import devicesRoot from './page'
import deviceAdd from './add-device.page'
import devicePaperKey from './paper-key.page'

export const newRoutes = {
  devicePage,
  deviceRevoke,
  devicesRoot,
}

export const newModalRoutes = {
  ...provisionNewRoutes,
  deviceAdd,
  devicePaperKey,
}

export type RootParamListDevices = Container.PagesToParams<typeof newRoutes & typeof newModalRoutes>
