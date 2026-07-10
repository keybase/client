import * as React from 'react'
import * as T from '@/constants/types'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as FS from '@/constants/fs'
import {Actions, MainBanner, MobileHeader, Title} from './nav-header'
import {IosHeaderTitle} from './nav-header/ios-header'
import {Filename, ItemIcon} from './common'
import {getIncomingShareSizes, OriginalOrCompressedButton} from '@/incoming-share'
import {defineRouteMap} from '@/constants/types/router'

const FsRoot = React.lazy(async () => import('.'))
const FsFilePreview = React.lazy(async () => import('./filepreview/file-preview-screen'))

const DestPickerHeaderLeft = ({source}: {source: T.FS.MoveOrCopySource | T.FS.IncomingShareSource}) => {
  const clearModals = C.Router2.clearModals
  const navigateUp = C.Router2.navigateUp
  if (!isMobile) return null
  if (source.type === T.FS.DestinationPickerSource.IncomingShare) {
    return (
      <Kb.Text type="BodyBigLink" onClick={navigateUp}>
        Back
      </Kb.Text>
    )
  }
  return (
    <Kb.Text type="BodyBigLink" onClick={clearModals}>
      Cancel
    </Kb.Text>
  )
}

// undefined when there's nothing to show: a set headerRight rendering null
// still gets an empty liquid glass circle on iOS 26
const destPickerHeaderRight = (source: T.FS.MoveOrCopySource | T.FS.IncomingShareSource) => {
  if (source.type !== T.FS.DestinationPickerSource.IncomingShare) return undefined
  if (getIncomingShareSizes(source.source).originalOnly) return undefined
  const items = source.source
  const HeaderRight = () => <OriginalOrCompressedButton incomingShareItems={items} />
  return HeaderRight
}

const DestPickerHeaderTitle = (props: {
  parentPath: T.FS.Path
  source: T.FS.MoveOrCopySource | T.FS.IncomingShareSource
}) => {
  const {parentPath, source} = props
  const targetName = FS.getDestinationPickerPathName(source)
  if (isMobile) {
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true}>
        <Filename type="BodyTiny" filename={targetName} />
        <Kb.Text type="BodyBig">Save in...</Kb.Text>
      </Kb.Box2>
    )
  }
  return (
    <Kb.Box2 direction="horizontal" centerChildren={true} style={destPickerDesktopHeaderStyle} gap="xtiny">
      <Kb.Text type="Header" style={noShrinkStyle}>
        {'Move or Copy "'}
      </Kb.Text>
      <ItemIcon size={16} path={T.FS.pathConcat(parentPath, targetName)} />
      <Filename type="Header" filename={targetName} />
      <Kb.Text type="Header" style={noShrinkStyle}>
        {'"'}
      </Kb.Text>
    </Kb.Box2>
  )
}
const destPickerDesktopHeaderStyle = Kb.Styles.padding(
  Kb.Styles.globalMargins.medium,
  Kb.Styles.globalMargins.medium,
  10
)
const noShrinkStyle = {flexShrink: 0} as const

// Options shared by fsRoot (the Files tab root) and fsBrowse (a folder pushed on
// top). They render the same screen; the only difference is where each lives in
// the navigator tree (see fsBrowse below).
const fsFolderGetOptions = (ownProps?: {route: {params?: {path?: T.FS.Path}}}) => {
  // strange edge case where the root can actually have no params
  const params = ownProps?.route.params
  const path = params?.path ?? FS.defaultPath
  if (isIOS) {
    // Native header so the back button and right items get liquid glass on iOS 26.
    // The banner, the folder-view filter, and the overflow menu (Search/Upload/
    // More) are all attached from the screen body; see fs/index.tsx.
    return {
      headerBackVisible: true,
      headerTitle: () => <IosHeaderTitle path={path} />,
    }
  }
  return isMobile
    ? {
        header: () => <MobileHeader path={path} />,
      }
    : {
        headerRightActions: () => <Actions path={path} onTriggerFilterMobile={() => {}} />,
        headerTitle: () => <Title path={path} />,
        subHeader: MainBanner,
        title: path === FS.defaultPath ? 'Files' : T.FS.getPathName(path),
      }
}

export const newRoutes = defineRouteMap({
  fsFilePreview: C.makeScreen(FsFilePreview, {
    getOptions: (ownProps?) => {
      const path = ownProps?.route.params.path ?? FS.defaultPath
      if (isIOS) {
        return {
          headerBackVisible: true,
          headerTitle: () => <IosHeaderTitle path={path} />,
          // Full-screen attachment preview is allowed to rotate.
          orientation: 'all' as const,
        }
      }
      return isMobile
        ? {
            header: () => <MobileHeader path={path} />,
            // Full-screen attachment preview is allowed to rotate.
            orientation: 'all' as const,
          }
        : {
            headerTitle: () => <Title path={path} />,
            title: T.FS.getPathName(path),
          }
    },
  }),
  fsRoot: C.makeScreen(FsRoot, {getOptions: fsFolderGetOptions}),
  // Same screen as fsRoot, but used when drilling into a folder. fsRoot is the
  // Files tab root (lives inside the tab stack); fsBrowse is not a tab root, so
  // on phones it lands in the app root stack and renders above the bottom tab
  // bar — hiding it on push, matching every other tab. Open a folder via
  // fsBrowse; jump into the Files tab from elsewhere via fsRoot.
  fsBrowse: C.makeScreen(FsRoot, {getOptions: fsFolderGetOptions}),
})

export const newModalRoutes = defineRouteMap({
  confirmDelete: C.makeScreen(React.lazy(async () => import('./common/path-item-action/confirm-delete'))),
  destinationPicker: C.makeScreen(
    React.lazy(async () => import('./browser/destination-picker')),
    {
      getOptions: ({route}) => ({
        ...(isIOS
          ? {
              unstable_headerLeftItems: () =>
                route.params.source.type === T.FS.DestinationPickerSource.IncomingShare
                  ? [Kb.nativeBackHeaderItem()]
                  : [Kb.nativeCancelHeaderItem(C.Router2.clearModals)],
            }
          : {headerLeft: () => <DestPickerHeaderLeft source={route.params.source} />}),
        headerRight: destPickerHeaderRight(route.params.source),
        headerTitle: () => (
          <DestPickerHeaderTitle parentPath={route.params.parentPath} source={route.params.source} />
        ),
        modalSize: 'wide',
      }),
    }
  ),
  kextPermission: {
    getOptions: {modalSize: 'wide'},
    screen: React.lazy(
      async () => import('./banner/system-file-manager-integration-banner/kext-permission-popup')
    ),
  },
})
