import * as C from '@/constants'
import * as T from '@/constants/types'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Kbfs from '../common'
import {useModalHeaderState} from '@/stores/modal-header'
import {FsBrowserEditProvider} from '../browser/edit-state'

type Props = {
  onTriggerFilterMobile: () => void
  path: T.FS.Path
}

const FsNavHeaderRightActionsInner = (props: Props) => {
  const {folderViewFilter, setFolderViewFilter} = useModalHeaderState(
    C.useShallow(s => ({
      folderViewFilter: s.folderViewFilter,
      setFolderViewFilter: s.dispatch.setFolderViewFilter,
    }))
  )
  const hasSoftError = !!Kbfs.useFsSoftError(props.path)
  React.useEffect(() => {
    if (!Kb.Styles.isMobile) {
      setFolderViewFilter() // mobile is handled in mobile-header.tsx
    }
  }, [setFolderViewFilter, props.path]) // clear if path changes or it's a new layer of mount

  return !hasSoftError ? (
    <Kb.Box2 direction="horizontal" style={styles.container} centerChildren={true}>
      <Kbfs.UploadButton path={props.path} style={styles.uploadButton} />
      {Kb.Styles.isMobile ? (
        <Kbfs.FolderViewFilterIcon path={props.path} onClick={props.onTriggerFilterMobile} />
      ) : (
        <Kbfs.FolderViewFilter
          onChangeFilter={setFolderViewFilter}
          path={props.path}
          style={styles.folderViewFilter}
          {...(folderViewFilter === undefined ? {} : {filter: folderViewFilter})}
        />
      )}
      <Kbfs.OpenInSystemFileManager path={props.path} />
      <Kbfs.PathItemAction
        path={props.path}
        clickable={{type: 'icon'}}
        initView={T.FS.PathItemActionMenuView.Root}
        mode="screen"
      />
    </Kb.Box2>
  ) : null
}

const FsNavHeaderRightActions = (props: Props) => (
  <Kbfs.FsErrorProvider>
    <Kbfs.FsDataProvider>
      <FsBrowserEditProvider>
        <FsNavHeaderRightActionsInner {...props} />
      </FsBrowserEditProvider>
    </Kbfs.FsDataProvider>
  </Kbfs.FsErrorProvider>
)

export default FsNavHeaderRightActions

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.desktopStyles.windowDraggingClickable,
          height: 28,
          // Supposed to be small, but icons already have padding
          paddingRight: Kb.Styles.globalMargins.tiny,
        },
      }),
      folderViewFilter: {
        marginRight: Kb.Styles.globalMargins.tiny,
        width: 140,
      },
      uploadButton: Kb.Styles.platformStyles({
        isElectron: {
          marginLeft: Kb.Styles.globalMargins.tiny,
          marginRight: Kb.Styles.globalMargins.tiny,
        },
      }),
    }) as const
)
