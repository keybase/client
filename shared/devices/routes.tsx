import * as React from 'react'
import * as C from '@/constants'
import {HeaderLeftCancel, type HeaderBackButtonProps} from '@/common-adapters/header-hoc'
import {newRoutes as provisionNewRoutes} from '../provision/routes-sub'
import {HeaderTitle, HeaderRightActions} from './nav-header'

export const newRoutes = {
  devicePage: C.makeScreen(
    React.lazy(async () => import('./device-page')),
    {getOptions: {title: ''}}
  ),
  deviceRevoke: C.makeScreen(
    React.lazy(async () => import('./device-revoke')),
    {
      getOptions: {
        headerLeft: (p: HeaderBackButtonProps) => <HeaderLeftCancel {...p} />,
        title: '',
      },
    }
  ),
  devicesRoot: {
    getOptions: C.isMobile
      ? {title: 'Devices'}
      : {
          headerRightActions: HeaderRightActions,
          headerTitle: HeaderTitle,
          title: 'Devices',
        },
    screen: React.lazy(async () => import('.')),
  },
}

export const newModalRoutes = {
  ...provisionNewRoutes,
  deviceAdd: C.makeScreen(React.lazy(async () => import('./add-device'))),
  devicePaperKey: {
    getOptions: {gesturesEnabled: false, modal2: true, modal2NoClose: true},
    screen: React.lazy(async () => import('./paper-key')),
  },
}

export type RootParamListDevices = C.PagesToParams<typeof newRoutes & typeof newModalRoutes>
