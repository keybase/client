import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Kbfs from '../common'
import * as T from '@/constants/types'
import * as FS from '@/constants/fs'
import type {SFSymbol} from 'sf-symbols-typescript'
import {useFolderViewFilterState} from '@/fs/common/folder-view-filter-state'
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
// wider side on both sides: the right glass pill holds the overflow menu (~120pt with edge margin).
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

const sfIcon = (name: SFSymbol) => ({name, type: 'sfSymbol' as const})

type MenuProps = {
  path: T.FS.Path
  // Folder screens allow uploads; the file preview screen does not.
  mayUpload: boolean
}

// iOS 26: a single overflow menu (one glass pill) replaces the old row of
// upload + actions buttons. Search / Upload / More each fire the same popups
// the Android header uses (the folder-view filter, the upload menu, and the
// path-item actions menu). Because the native menu's onPress needs to reach
// React state, the menu is attached from the screen body via setOptions rather
// than statically in getOptions.
const IosHeaderMenuInner = ({path, mayUpload}: MenuProps) => {
  Kbfs.useFsScreenCoordinator(path)
  const navigation = useNavigation()
  const hasSoftError = !!Kbfs.useFsSoftError(path)
  const pathItem = Kbfs.useFsPathItem(path)
  const folderViewFilter = useFolderViewFilterState(s => s.folderViewFilter)
  const setFolderViewFilter = useFolderViewFilterState(s => s.dispatch.setFolderViewFilter)
  const uploadRef = React.useRef<Kbfs.UploadButtonHandle>(null)
  const moreRef = React.useRef<Kbfs.PathItemActionHandle>(null)

  const canFilter = FS.isFolder(path, pathItem) && T.FS.getPathLevel(path) > 1
  const canUpload = mayUpload && pathItem.type === T.FS.PathType.Folder && pathItem.writable

  React.useEffect(() => {
    navigation.setOptions({
      unstable_headerRightItems:
        hasSoftError || path === FS.defaultPath
          ? undefined
          : () => [
              {
                icon: sfIcon('ellipsis'),
                label: 'More',
                menu: {
                  items: [
                    ...(canFilter
                      ? [
                          {
                            icon: sfIcon('magnifyingglass'),
                            label: 'Search',
                            onPress: () => setFolderViewFilter(''),
                            type: 'action' as const,
                          },
                        ]
                      : []),
                    ...(canUpload
                      ? [
                          {
                            icon: sfIcon('arrow.up.doc'),
                            label: 'Upload',
                            onPress: () => uploadRef.current?.open(),
                            type: 'action' as const,
                          },
                        ]
                      : []),
                    {
                      icon: sfIcon('ellipsis'),
                      label: 'More',
                      onPress: () => moreRef.current?.open(),
                      type: 'action' as const,
                    },
                  ],
                },
                type: 'menu' as const,
              },
            ],
    })
  }, [navigation, hasSoftError, path, canFilter, canUpload, setFolderViewFilter])

  // The filter is per-screen UI state living in a global store; clear it when
  // the path changes or the screen goes away.
  React.useEffect(() => () => setFolderViewFilter(), [setFolderViewFilter, path])

  const filterExpanded = canFilter && folderViewFilter !== undefined

  return (
    <>
      {filterExpanded ? (
        <Kbfs.FolderViewFilter
          filter={folderViewFilter}
          onCancel={() => setFolderViewFilter()}
          onChangeFilter={setFolderViewFilter}
          path={path}
        />
      ) : null}
      {/* Headless: rendered only to host the popups the native menu opens. */}
      {mayUpload ? <Kbfs.UploadButton ref={uploadRef} path={path} hideTrigger={true} /> : null}
      <Kbfs.PathItemAction
        ref={moreRef}
        path={path}
        clickable={{type: 'icon'}}
        initView={T.FS.PathItemActionMenuView.Root}
        mode="screen"
        hideTrigger={true}
      />
    </>
  )
}

export const IosHeaderMenu = (props: MenuProps) => (
  <FsBrowserEditProvider>
    <IosHeaderMenuInner {...props} />
  </FsBrowserEditProvider>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      statusIcon: Kb.Styles.size(Kb.Styles.globalMargins.small),
    }) as const
)
