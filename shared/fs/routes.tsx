import * as React from 'react'
import * as T from '@/constants/types'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as FS from '@/stores/fs'
import {useFSState} from '@/stores/fs'
import {Actions, MainBanner, MobileHeader, Title} from './nav-header'
import {Filename, ItemIcon} from './common'
import {OriginalOrCompressedButton} from '@/incoming-share'

const FsRoot = React.lazy(async () => import('.'))

const getDestPickerParentPath = (dp: T.FS.DestinationPicker, index: number): T.FS.Path =>
  dp.destinationParentPath[index] ||
  (dp.source.type === T.FS.DestinationPickerSource.MoveOrCopy
    ? T.FS.getPathParent(dp.source.path)
    : T.FS.stringToPath('/keybase'))

const DestPickerHeaderLeft = () => {
  const isShare = useFSState(s => s.destinationPicker.source.type === T.FS.DestinationPickerSource.IncomingShare)
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  if (!Kb.Styles.isMobile) return null
  if (isShare) {
    return <Kb.Text type="BodyBigLink" onClick={navigateUp}>Back</Kb.Text>
  }
  return <Kb.Text type="BodyBigLink" onClick={clearModals}>Cancel</Kb.Text>
}

const DestPickerHeaderRight = () => {
  const source = useFSState(s => s.destinationPicker.source)
  if (source.type !== T.FS.DestinationPickerSource.IncomingShare) return null
  return <OriginalOrCompressedButton incomingShareItems={source.source} />
}

const DestPickerHeaderTitle = ({index}: {index: number}) => {
  const {targetName, parentPath} = useFSState(s => {
    const dp = s.destinationPicker
    return {
      parentPath: getDestPickerParentPath(dp, index),
      targetName: FS.getDestinationPickerPathName(dp),
    }
  })
  if (Kb.Styles.isMobile) {
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true}>
        <Filename type="BodyTiny" filename={targetName} />
        <Kb.Text type="BodyBig">Save in...</Kb.Text>
      </Kb.Box2>
    )
  }
  return (
    <Kb.Box2 direction="horizontal" centerChildren={true} style={destPickerDesktopHeaderStyle} gap="xtiny">
      <Kb.Text type="Header" style={noShrinkStyle}>{'Move or Copy "'}</Kb.Text>
      <ItemIcon size={16} path={T.FS.pathConcat(parentPath, targetName)} />
      <Filename type="Header" filename={targetName} />
      <Kb.Text type="Header" style={noShrinkStyle}>{'"'}</Kb.Text>
    </Kb.Box2>
  )
}
const destPickerDesktopHeaderStyle = Kb.Styles.padding(Kb.Styles.globalMargins.medium, Kb.Styles.globalMargins.medium, 10)
const noShrinkStyle = {flexShrink: 0} as const

export const newRoutes = {
  fsRoot: C.makeScreen(FsRoot, {
    getOptions: (ownProps?) => {
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
    }),
    {getOptions: {headerShown: false}}
  ),
  confirmDelete: C.makeScreen(React.lazy(async () => import('./common/path-item-action/confirm-delete'))),
  destinationPicker: C.makeScreen(React.lazy(async () => import('./browser/destination-picker')), {
    getOptions: ({route}) => ({
      headerLeft: () => <DestPickerHeaderLeft />,
      headerRight: () => <DestPickerHeaderRight />,
      headerTitle: () => <DestPickerHeaderTitle index={route.params.index} />,
    }),
  }),
  kextPermission: {
    getOptions: {modalStyle: {width: 700}},
    screen: React.lazy(
      async () => import('./banner/system-file-manager-integration-banner/kext-permission-popup')
    ),
  },
}
