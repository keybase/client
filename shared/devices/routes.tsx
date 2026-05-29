import * as React from 'react'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {HeaderLeftButton, type HeaderBackButtonProps} from '@/common-adapters/header-buttons'
import {newRoutes as provisionNewRoutes} from '../provision/routes-sub'
import {useProvisionState} from '@/stores/provision'
import {defineRouteMap} from '@/constants/types/router'

export const HeaderTitle = ({activeCount, revokedCount}: {activeCount: number; revokedCount: number}) => (
  <Kb.Box2 direction="vertical" style={headerStyles.headerTitle}>
    <Kb.Text type="Header">Devices</Kb.Text>
    <Kb.Text type="BodySmall">
      {activeCount} Active • {revokedCount} Revoked
    </Kb.Text>
  </Kb.Box2>
)

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
  headerTitle: {
    paddingBottom: Kb.Styles.globalMargins.xtiny,
    paddingLeft: Kb.Styles.globalMargins.xsmall,
  },
}))

const AddDeviceCancelButton = () => {
  const cancel = useProvisionState(s => s.dispatch.dynamic.cancel)
  const navigateUp = C.Router2.navigateUp
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

export const newRoutes = defineRouteMap({
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
      modalStyle: {width: 620},
      title: 'Add a device',
    },
  }),
  devicePaperKey: {
    getOptions: {gestureEnabled: false, overlayNoClose: true},
    screen: React.lazy(async () => import('./paper-key')),
  },
})
