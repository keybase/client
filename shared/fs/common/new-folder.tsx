import * as Container from '../../util/container'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Kb from '../../common-adapters'
import * as FsGen from '../../actions/fs-gen'
import * as Styles from '../../styles'
import * as React from 'react'

type OwnProps = {path: Types.Path}

const styles = Styles.styleSheetCreate(() => ({headerIcon: {padding: Styles.globalMargins.tiny}} as const))

const NewFolder = (op: OwnProps) => {
  const {path} = op
  const pathItem = Container.useSelector(state => Constants.getPathItem(state.fs.pathItems, path))
  const canCreateNewFolder = pathItem.type === Types.PathType.Folder && pathItem.writable
  const dispatch = Container.useDispatch()
  const onNewFolder = React.useCallback(
    () => dispatch(FsGen.createNewFolderRow({parentPath: path})),
    [dispatch, path]
  )
  return (
    canCreateNewFolder && (
      <Kb.WithTooltip tooltip="New Folder">
        <Kb.Icon
          type="iconfont-folder-new"
          color={Styles.globalColors.black_50}
          fontSize={16}
          onClick={onNewFolder}
          style={styles.headerIcon}
        />
      </Kb.WithTooltip>
    )
  )
}
export default NewFolder
