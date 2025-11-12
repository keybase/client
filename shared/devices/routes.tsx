import * as React from 'react'
import * as C from '@/constants'
import {HeaderLeftCancel, type HeaderBackButtonProps} from '@/common-adapters/header-hoc'
import {newRoutes as provisionNewRoutes} from '../provision/routes-sub'
import {HeaderTitle, HeaderRightActions} from './nav-header'

const DevicesRoot = React.lazy(async () => import('.'))
const devicesRoot = {
  getOptions: C.isMobile
    ? {title: 'Devices'}
    : {
        headerRightActions: HeaderRightActions,
        headerTitle: HeaderTitle,
        title: 'Devices',
      },
  screen: DevicesRoot,
}

const Add = React.lazy(async () => import('./add-device'))
const deviceAdd = {
  screen: function DeviceAdd(p: C.ViewPropsToPageProps<typeof Add>) {
    return <Add {...p.route.params} />
  },
}

const PaperKey = React.lazy(async () => import('./paper-key'))
const devicePaperKey = {
  getOptions: {gesturesEnabled: false, modal2: true, modal2NoClose: true},
  screen: PaperKey,
}

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
