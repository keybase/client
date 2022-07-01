import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Kbfs from '../common'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as FsGen from '../../actions/fs-gen'

type Props = {
  onTriggerFilterMobile: () => void
  path: Types.Path
}

const FsNavHeaderRightActions = (props: Props) => {
  const softErrors = Container.useSelector(state => state.fs.softErrors)
  const hasSoftError = !!Constants.getSoftError(softErrors, props.path)

  const dispatch = Container.useDispatch()
  React.useEffect(() => {
    !Styles.isMobile && dispatch(FsGen.createSetFolderViewFilter({filter: null})) // mobile is handled in mobile-header.tsx
  }, [dispatch, props.path]) // clear if path changes or it's a new layer of mount

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
    } as const)
)
