import * as C from '../../constants'
import * as Constants from '../../constants/fs'
import * as Types from '../../constants/types/fs'
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Kbfs from '../common'
import * as Styles from '../../styles'

type Props = {
  onTriggerFilterMobile: () => void
  path: Types.Path
}

const FsNavHeaderRightActions = (props: Props) => {
  const softErrors = C.useFSState(s => s.softErrors)
  const hasSoftError = !!Constants.getSoftError(softErrors, props.path)
  const setFolderViewFilter = C.useFSState(s => s.dispatch.setFolderViewFilter)
  React.useEffect(() => {
    !Styles.isMobile && setFolderViewFilter() // mobile is handled in mobile-header.tsx
  }, [setFolderViewFilter, props.path]) // clear if path changes or it's a new layer of mount

  return !hasSoftError ? (
    <Kb.Box2 direction="horizontal" style={styles.container} centerChildren={true}>
      <Kbfs.UploadButton path={props.path} style={styles.uploadButton} />
      {Styles.isMobile ? (
        <Kbfs.FolderViewFilterIcon path={props.path} onClick={props.onTriggerFilterMobile} />
      ) : (
        <Kbfs.FolderViewFilter path={props.path} style={styles.folderViewFilter} />
      )}
      <Kbfs.OpenInSystemFileManager path={props.path} />
      <Kbfs.PathItemAction
        path={props.path}
        clickable={{type: 'icon'}}
        initView={Types.PathItemActionMenuView.Root}
        mode="screen"
      />
    </Kb.Box2>
  ) : null
}

export default FsNavHeaderRightActions

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: Styles.platformStyles({
        isElectron: {
          ...Styles.desktopStyles.windowDraggingClickable,
          height: 28,
          // Supposed to be small, but icons already have padding
          paddingRight: Styles.globalMargins.tiny,
        },
      }),
      folderViewFilter: {
        marginRight: Styles.globalMargins.tiny,
        width: 140,
      },
      uploadButton: Styles.platformStyles({
        isElectron: {
          marginLeft: Styles.globalMargins.tiny,
          marginRight: Styles.globalMargins.tiny,
        },
      }),
    }) as const
)
