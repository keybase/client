import * as React from 'react'
import * as T from '@/constants/types'
import * as C from '@/constants'
import {Actions, MainBanner, MobileHeader, Title} from './nav-header'

type FsRootProps = C.ViewPropsToPageProps<typeof FsRoot>
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

const FsRoot = React.lazy(async () => import('.'))
const fsRoot = {
  getOptions,
  screen: function FsRootScreen(p: FsRootProps) {
    return <FsRoot {...p.route.params} />
  },
}

const BarePreview = React.lazy(async () => {
  const {BarePreview} = await import('./filepreview')
  return {default: BarePreview}
})
const barePreview = {
  screen: function BarePreviewScreen(p: C.ViewPropsToPageProps<typeof BarePreview>) {
    return <BarePreview {...p.route.params} />
  },
}

const Confirm = React.lazy(async () => import('./common/path-item-action/confirm-delete/container'))
const confirmDelete = {
  screen: function ConfirmDelete(p: C.ViewPropsToPageProps<typeof Confirm>) {
    return <Confirm {...p.route.params} />
  },
}

const Picker = React.lazy(async () => import('./browser/destination-picker'))
const destinationPicker = {
  screen: function DestinationPicker(p: C.ViewPropsToPageProps<typeof Picker>) {
    return <Picker {...p.route.params} />
  },
}

const KextPermission = React.lazy(
  async () => import('./banner/system-file-manager-integration-banner/kext-permission-popup')
)
const kextPermission = {screen: KextPermission}

export const newRoutes = {fsRoot}

export const newModalRoutes = {
  barePreview,
  confirmDelete,
  destinationPicker,
  kextPermission,
}

export type RootParamListFS = C.PagesToParams<typeof newRoutes & typeof newModalRoutes>
