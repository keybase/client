import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import LastModifiedLine from './last-modified-line-container'
import TlfInfoLine from './tlf-info-line-container'
import PathItemIcon from './path-item-icon-container'
import CommaSeparatedName from './comma-separated-name'
import * as Container from '../../util/container'
import {useFsChildren, useFsPathMetadata, useFsOnlineStatus} from './hooks'

type Props = {
  containerStyle?: Styles.StylesCrossPlatform
  showTooltipOnName: boolean
  path: Types.Path
}

const getChildrenNumbers = (
  pathItems: Types.PathItems,
  path: Types.Path
): {folders: number; files: number} => {
  const pathItem = pathItems.get(path, Constants.unknownPathItem)
  return pathItem.type === Types.PathType.Folder
    ? pathItem.children.reduce(
        ({folders, files}, p) => {
          const isFolder =
            pathItems.get(Types.pathConcat(path, p), Constants.unknownPathItem).type === Types.PathType.Folder
          return {
            files: files + (isFolder ? 0 : 1),
            folders: folders + (isFolder ? 1 : 0),
          }
        },
        {files: 0, folders: 0}
      )
    : {files: 0, folders: 0}
}

const FilesAndFoldersCount = (props: Props) => {
  useFsChildren(props.path)
  const pathItems = Container.useSelector(state => state.fs.pathItems)
  const {files, folders} = getChildrenNumbers(pathItems, props.path)
  return (
    <Kb.Text type="BodySmall">
      {folders ? `${folders} Folder${folders > 1 ? 's' : ''}${files ? ', ' : ''}` : undefined}
      {files ? `${files} File${files > 1 ? 's' : ''}` : undefined}
    </Kb.Text>
  )
}

const getTlfInfoLineOrLastModifiedLine = (path: Types.Path) => {
  switch (Types.getPathLevel(path)) {
    case 0:
    case 1:
    case 2:
      return null
    case 3:
      // TlfInfoLine does not have a mode='menu'
      return <TlfInfoLine path={path} mode="default" />
    default:
      return <LastModifiedLine path={path} mode="menu" />
  }
}

const PathItemInfo = (props: Props) => {
  useFsOnlineStatus() // when used in chat, we don't have this from Files tab
  useFsPathMetadata(props.path)
  const pathItem = Container.useSelector(state =>
    state.fs.pathItems.get(props.path, Constants.unknownPathItem)
  )
  const name = (
    <CommaSeparatedName
      center={true}
      type="BodySmallSemibold"
      name={Types.getPathName(props.path)}
      elementStyle={styles.stylesNameText}
    />
  )
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true} style={props.containerStyle}>
      <PathItemIcon path={props.path} size={48} style={styles.pathItemIcon} />
      {props.showTooltipOnName ? (
        <Kb.WithTooltip
          containerStyle={styles.nameTextBox}
          text={Types.pathToString(props.path)}
          multiline={true}
          showOnPressMobile={true}
        >
          {name}
        </Kb.WithTooltip>
      ) : (
        <Kb.Box style={styles.nameTextBox}>{name}</Kb.Box>
      )}
      {pathItem.type === Types.PathType.File && (
        <Kb.Text type="BodySmall">{Constants.humanReadableFileSize(pathItem.size)}</Kb.Text>
      )}
      {pathItem.type === Types.PathType.Folder && <FilesAndFoldersCount {...props} />}
      {getTlfInfoLineOrLastModifiedLine(props.path)}
    </Kb.Box2>
  )
}

export default PathItemInfo

const styles = Styles.styleSheetCreate({
  nameTextBox: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    isElectron: {
      textAlign: 'center',
    },
  }),
  pathItemIcon: {
    marginBottom: Styles.globalMargins.xtiny,
  },
  stylesNameText: {
    textAlign: 'center',
  },
})
