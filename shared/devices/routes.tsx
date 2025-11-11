import * as React from 'react'
import type * as C from '@/constants'
import {HeaderLeftCancel, type HeaderBackButtonProps} from '@/common-adapters/header-hoc'
import {newRoutes as provisionNewRoutes} from '../provision/routes-sub'

import devicesRoot from './page'
import deviceAdd from './add-device.page'
import devicePaperKey from './paper-key.page'

const Device = React.lazy(async () => import('./device-page'))
const devicePage = {
  getOptions: {title: ''},
  screen: function DevicePage(p: C.ViewPropsToPageProps<typeof Device>) {
    return <Device {...p.route.params} />
  },
}

const Revoke = React.lazy(async () => import('./device-revoke'))
const deviceRevoke = {
  getOptions: {
    headerLeft: (p: HeaderBackButtonProps) => <HeaderLeftCancel {...p} />,
    title: '',
  },
  screen: function DeviceRevoke(p: C.ViewPropsToPageProps<typeof Revoke>) {
    return <Revoke {...p.route.params} />
  },
}

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

export type RootParamListDevices = C.PagesToParams<typeof newRoutes & typeof newModalRoutes>
