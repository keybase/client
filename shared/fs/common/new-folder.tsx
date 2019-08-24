import {namedConnect} from '../../util/container'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Kb from '../../common-adapters'
import * as FsGen from '../../actions/fs-gen'
import * as Styles from '../../styles'
import * as React from 'react'

type OwnProps = {
  path: Types.Path
}

const NewFolder = props =>
  props.canCreateNewFolder && (
    <Kb.WithTooltip text="New Folder">
      <Kb.Icon
        type="iconfont-folder-new"
        color={Styles.globalColors.black_50}
        fontSize={16}
        onClick={props.onNewFolder}
        style={styles.headerIcon}
      />
    </Kb.WithTooltip>
  )

const styles = Styles.styleSheetCreate({
  headerIcon: {
    padding: Styles.globalMargins.tiny,
  },
})

const mapStateToProps = (state, {path}) => ({
  _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
})

const mapDispatchToProps = (dispatch, {path}) => ({
  onNewFolder: () =>
    dispatch(
      FsGen.createNewFolderRow({
        parentPath: path,
      })
    ),
})

const mergeProps = (s, d, _: OwnProps) => ({
  canCreateNewFolder: s._pathItem.type === Types.PathType.Folder && s._pathItem.writable,
  ...d,
})

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'NewFolder')(NewFolder)
