import * as React from 'react'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {HeaderLeftButton, type HeaderBackButtonProps} from '@/common-adapters/header-buttons'
import {newRoutes as provisionNewRoutes} from '../provision/routes-sub'
import {HeaderTitle, HeaderRightActions} from './nav-header'
import {useProvisionState} from '@/stores/provision'

const AddDeviceCancelButton = () => {
  const cancel = useProvisionState(s => s.dispatch.dynamic.cancel)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  return (
    <Kb.Text
      type="BodyBigLink"
      onClick={() => {
        cancel?.()
        navigateUp()
      }}
    >
      Cancel
    </Kb.Text>
  )
}

export const newRoutes = {
  devicePage: C.makeScreen(
    React.lazy(async () => import('./device-page')),
    {getOptions: {title: ''}}
  ),
  deviceRevoke: C.makeScreen(
    React.lazy(async () => import('./device-revoke')),
    {
      getOptions: {
        headerLeft: (p: HeaderBackButtonProps) => <HeaderLeftButton mode="cancel" {...p} />,
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
  deviceAdd: C.makeScreen(React.lazy(async () => import('./add-device')), {
    getOptions: {
      headerLeft: C.isMobile ? () => <AddDeviceCancelButton /> : undefined,
      modalStyle: {width: 620},
      title: 'Add a device',
    },
  }),
  devicePaperKey: {
    getOptions: {gestureEnabled: false, overlayNoClose: true},
    screen: React.lazy(async () => import('./paper-key')),
  },
}
