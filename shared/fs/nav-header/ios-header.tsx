import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Kbfs from '../common'
import * as T from '@/constants/types'
import * as FS from '@/constants/fs'
import {useModalHeaderState} from '@/stores/modal-header'
import {useNavigation} from '@react-navigation/native'
import {useSafeAreaFrame} from 'react-native-safe-area-context'
import {FsBrowserEditProvider} from '../browser/edit-state'

// iOS renders fs screens with the native header so the back button and right
// items get the system liquid glass treatment. Android keeps the fully custom
// header (mobile-header.tsx).

const MaybePublicTag = ({path}: {path: T.FS.Path}) =>
  FS.hasPublicTag(path) ? <Kb.Meta title="public" backgroundColor={Kb.Styles.globalColors.green} /> : null

const FilesTabStatusIcon = () => {
  const uploadIcon = Kbfs.useFilesTabUploadIcon()
  return uploadIcon ? <Kbfs.UploadIcon uploadIcon={uploadIcon} style={styles.statusIcon} /> : null
}

// maxWidth only, no minWidth — same trick as chat's header (see chat/conversation/header-area):
// the native header doesn't constrain a custom title view against the left/right items, so a
// long filename otherwise renders underneath them. The title is centered, so it must clear the
// wider side on both sides: the right glass pill holds two items (~120pt including edge margin).
const useMaxWidthStyle = () => {
  const {width} = useSafeAreaFrame()
  return {maxWidth: width - 240}
}

const TitleInner = ({path}: {path: T.FS.Path}) => {
  const maxWidthStyle = useMaxWidthStyle()
  return path === FS.defaultPath ? (
    <Kb.Box2 direction="horizontal" centerChildren={true} gap="xtiny">
      <Kb.Text type="BodyBig">Files</Kb.Text>
      <FilesTabStatusIcon />
    </Kb.Box2>
  ) : (
    <Kb.Box2 direction="vertical" centerChildren={true} style={maxWidthStyle}>
      <Kb.Box2 direction="horizontal" centerChildren={true} gap="xxtiny">
        <Kbfs.PathStatusIcon path={path} showTooltipOnPressMobile={true} />
        <Kbfs.Filename path={path} selectable={true} type="BodyBig" />
      </Kb.Box2>
      <MaybePublicTag path={path} />
    </Kb.Box2>
  )
}

export const IosHeaderTitle = ({path}: {path: T.FS.Path}) => (
  <Kbfs.FsErrorProvider>
    <Kbfs.FsDataProvider>
      <TitleInner path={path} />
    </Kbfs.FsDataProvider>
  </Kbfs.FsErrorProvider>
)

type RightItemsProps = {
  path: T.FS.Path
  // Folder screens always show the upload button (dimmed when not allowed);
  // file preview never shows it.
  mayUpload: boolean
}

const RightItemsInner = ({path, mayUpload}: RightItemsProps) => {
  Kbfs.useFsScreenCoordinator(path)
  const hasSoftError = !!Kbfs.useFsSoftError(path)
  return !hasSoftError ? (
    <Kb.Box2 direction="horizontal" centerChildren={true}>
      <FilesTabStatusIcon />
      {/* showDisabled keeps the icon (dimmed) when uploads aren't allowed, so the glass pill never resizes */}
      {mayUpload && <Kbfs.UploadButton path={path} showDisabled={true} />}
      <Kbfs.PathItemAction
        path={path}
        clickable={{type: 'icon'}}
        initView={T.FS.PathItemActionMenuView.Root}
        mode="screen"
      />
    </Kb.Box2>
  ) : null
}

export const IosHeaderRightItems = (props: RightItemsProps) => (
  <Kbfs.FsErrorProvider>
    <Kbfs.FsDataProvider>
      <FsBrowserEditProvider>
        <RightItemsInner {...props} />
      </FsBrowserEditProvider>
    </Kbfs.FsDataProvider>
  </Kbfs.FsErrorProvider>
)

// Mounted from the screen body (fs/index): getOptions can't know whether the
// path is a filterable folder (that's store state), so the native search bar
// is attached via setOptions once it is.
export const IosHeaderSearch = ({path}: {path: T.FS.Path}) => {
  const setFolderViewFilter = useModalHeaderState(s => s.dispatch.setFolderViewFilter)
  const pathItem = Kbfs.useFsPathItem(path)
  const show = FS.isFolder(path, pathItem) && T.FS.getPathLevel(path) > 1
  const navigation = useNavigation()
  React.useEffect(() => {
    navigation.setOptions({
      headerSearchBarOptions: show
        ? {
            onCancelButtonPress: () => setFolderViewFilter(),
            onChange: (e: {nativeEvent: {text: string}}) => setFolderViewFilter(e.nativeEvent.text),
            placeholder: 'Filter',
            placement: 'integratedButton' as const,
          }
        : undefined,
    })
  }, [navigation, show, setFolderViewFilter])
  // The filter is per-screen UI state living in a global store; clear it when
  // the path changes or the screen goes away.
  React.useEffect(() => () => setFolderViewFilter(), [setFolderViewFilter, path])
  return null
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      statusIcon: Kb.Styles.size(Kb.Styles.globalMargins.small),
    }) as const
)
