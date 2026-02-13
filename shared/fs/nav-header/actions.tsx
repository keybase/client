import * as C from '@/constants'
import * as T from '@/constants/types'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Kbfs from '../common'
import * as FS from '@/stores/fs'
import {useFSState} from '@/stores/fs'

type Props = {
  onTriggerFilterMobile: () => void
  path: T.FS.Path
}

const FsNavHeaderRightActions = (props: Props) => {
  const {softErrors, setFolderViewFilter} = useFSState(
    C.useShallow(s => ({
      setFolderViewFilter: s.dispatch.setFolderViewFilter,
      softErrors: s.softErrors,
    }))
  )
  const hasSoftError = !!FS.getSoftError(softErrors, props.path)
  React.useEffect(() => {
    !Kb.Styles.isMobile && setFolderViewFilter() // mobile is handled in mobile-header.tsx
  }, [setFolderViewFilter, props.path]) // clear if path changes or it's a new layer of mount

  return !hasSoftError ? (
    <Kb.Box2 direction="horizontal" style={styles.container} centerChildren={true}>
      <Kbfs.UploadButton path={props.path} style={styles.uploadButton} />
      {Kb.Styles.isMobile ? (
        <Kbfs.FolderViewFilterIcon path={props.path} onClick={props.onTriggerFilterMobile} />
      ) : (
        <Kbfs.FolderViewFilter path={props.path} style={styles.folderViewFilter} />
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
