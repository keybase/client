import * as React from 'react'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {newRoutes as provisionNewRoutes} from '../provision/routes-sub'
import {cancelProvision} from '@/provision/flow'
import {defineRouteMap} from '@/constants/types/router'
import {HeaderTitle} from './common'

const HeaderRightActions = () => {
  const navigateAppend = C.Router2.navigateAppend
  const onAdd = () => navigateAppend({name: 'deviceAdd', params: {}})
  return (
    <Kb.Button
      small={true}
      label="Add a device or paper key"
      onClick={onAdd}
      style={headerStyles.addDeviceButton}
    />
  )
}

const headerStyles = Kb.Styles.styleSheetCreate(() => ({
  addDeviceButton: Kb.Styles.platformStyles({
    common: {
      alignSelf: 'flex-end',
      marginBottom: 6,
      marginRight: Kb.Styles.globalMargins.xsmall,
    },
    isElectron: Kb.Styles.desktopStyles.windowDraggingClickable,
  }),
}))

const AddDeviceCancelButton = () => (
  <Kb.Text
    type="BodyBigLink"
    onClick={() => {
      cancelProvision()
      C.Router2.navigateUp()
    }}
  >
    Cancel
  </Kb.Text>
)

export const newRoutes = defineRouteMap({
  devicePage: C.makeScreen(
    React.lazy(async () => import('./device-page')),
    {getOptions: {title: ''}}
  ),
  devicesRoot: {
    getOptions: isMobile
      ? {title: 'Devices'}
      : {
          headerRightActions: HeaderRightActions,
          headerTitle: () => <HeaderTitle activeCount={0} revokedCount={0} />,
          title: 'Devices',
        },
    screen: React.lazy(async () => import('.')),
  },
})

export const newModalRoutes = defineRouteMap({
  ...provisionNewRoutes,
  deviceAdd: C.makeScreen(React.lazy(async () => import('./add-device')), {
    getOptions: {
      headerLeft: isMobile ? () => <AddDeviceCancelButton /> : undefined,
      modalSize: 'wide',
      title: 'Add a device',
    },
  }),
  devicePaperKey: {
    getOptions: {gestureEnabled: false, overlayNoClose: true},
    screen: React.lazy(async () => import('./paper-key')),
  },
  deviceRevoke: C.makeScreen(React.lazy(async () => import('./device-revoke')), {
    getOptions: {modalSize: 'wide'},
  }),
})
