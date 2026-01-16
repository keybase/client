import * as React from 'react'
import * as T from '@/constants/types'
import * as C from '@/constants'
import * as FS from '@/stores/fs'
import {Actions, MainBanner, MobileHeader, Title} from './nav-header'

const FsRoot = React.lazy(async () => import('.'))

export const newRoutes = {
  fsRoot: C.makeScreen(FsRoot, {
    getOptions: (ownProps?: C.ViewPropsToPageProps<typeof FsRoot>) => {
      // strange edge case where the root can actually have no params
      // eslint-disable-next-line
      const path = ownProps?.route.params?.path ?? FS.defaultPath
      return C.isMobile
        ? {header: () => <MobileHeader path={path} />}
        : {
            headerRightActions: () => <Actions path={path} onTriggerFilterMobile={() => {}} />,
            headerTitle: () => <Title path={path} />,
            subHeader: MainBanner,
            title: path === FS.defaultPath ? 'Files' : T.FS.getPathName(path),
          }
    },
  }),
}

export const newModalRoutes = {
  barePreview: C.makeScreen(
    React.lazy(async () => {
      const {BarePreview} = await import('./filepreview')
      return {default: BarePreview}
    })
  ),
  confirmDelete: C.makeScreen(React.lazy(async () => import('./common/path-item-action/confirm-delete'))),
  destinationPicker: C.makeScreen(React.lazy(async () => import('./browser/destination-picker'))),
  kextPermission: {
    screen: React.lazy(
      async () => import('./banner/system-file-manager-integration-banner/kext-permission-popup')
    ),
  },
}

export type RootParamListFS = C.PagesToParams<typeof newRoutes & typeof newModalRoutes>
