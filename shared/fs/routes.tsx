import * as React from 'react'
import * as T from '@/constants/types'
import * as C from '@/constants'
import {Actions, MainBanner, MobileHeader, Title} from './nav-header'

type FsRootProps = C.ViewPropsToPageProps<ReturnType<typeof React.lazy<any>>>
const getOptions = (ownProps?: FsRootProps) => {
  const path = ownProps?.route.params?.path ?? C.FS.defaultPath
  return C.isMobile
    ? {header: () => <MobileHeader path={path} />}
    : {
        headerRightActions: () => <Actions path={path} onTriggerFilterMobile={() => {}} />,
        headerTitle: () => <Title path={path} />,
        subHeader: MainBanner,
        title: path === C.FS.defaultPath ? 'Files' : T.FS.getPathName(path),
      }
}

export const newRoutes = {
  fsRoot: C.makeScreen(React.lazy(async () => import('.')), {getOptions}),
}

export const newModalRoutes = {
  barePreview: C.makeScreen(
    React.lazy(async () => {
      const {BarePreview} = await import('./filepreview')
      return {default: BarePreview}
    })
  ),
  confirmDelete: C.makeScreen(React.lazy(async () => import('./common/path-item-action/confirm-delete/container'))),
  destinationPicker: C.makeScreen(React.lazy(async () => import('./browser/destination-picker'))),
  kextPermission: C.makeScreen(
    React.lazy(async () => import('./banner/system-file-manager-integration-banner/kext-permission-popup'))
  ),
}

export type RootParamListFS = C.PagesToParams<typeof newRoutes & typeof newModalRoutes>
