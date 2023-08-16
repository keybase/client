import * as T from '../../constants/types'
import * as C from '../../constants'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as React from 'react'

type OwnProps = {path: T.FS.Path}

const styles = Styles.styleSheetCreate(() => ({headerIcon: {padding: Styles.globalMargins.tiny}}) as const)

const NewFolder = (op: OwnProps) => {
  const {path} = op
  const pathItem = C.useFSState(s => C.getPathItem(s.pathItems, path))
  const canCreateNewFolder = pathItem.type === T.FS.PathType.Folder && pathItem.writable
  const newFolderRow = C.useFSState(s => s.dispatch.newFolderRow)
  const onNewFolder = React.useCallback(() => {
    newFolderRow(path)
  }, [newFolderRow, path])
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
