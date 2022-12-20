import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import LastModifiedLine from './last-modified-line-container'
import TlfInfoLine from './tlf-info-line-container'
import ItemIcon from './item-icon'
import CommaSeparatedName from './comma-separated-name'
import * as Container from '../../util/container'
import {pluralize} from '../../util/string'
import {useFsChildren, useFsPathMetadata, useFsOnlineStatus, useFsSoftError} from './hooks'

type Props = {
  containerStyle?: Styles.StylesCrossPlatform
  path: Types.Path
}

const getNumberOfFilesAndFolders = (
  pathItems: Types.PathItems,
  path: Types.Path
): {folders: number; files: number; loaded: boolean} => {
  const pathItem = Constants.getPathItem(pathItems, path)
  return pathItem.type === Types.PathType.Folder
    ? [...pathItem.children].reduce(
        ({folders, files, loaded}, p) => {
          const item = Constants.getPathItem(pathItems, Types.pathConcat(path, p))
          const isFolder = item.type === Types.PathType.Folder
          const isFile = item.type !== Types.PathType.Folder && item !== Constants.unknownPathItem
          return {
            files: files + (isFile ? 1 : 0),
            folders: folders + (isFolder ? 1 : 0),
            loaded,
          }
        },
        {files: 0, folders: 0, loaded: pathItem.progress === Types.ProgressType.Loaded}
      )
    : {files: 0, folders: 0, loaded: false}
}

const FilesAndFoldersCount = (props: Props) => {
  useFsChildren(props.path)
  const pathItems = Container.useSelector(state => state.fs.pathItems)
  const {files, folders, loaded} = getNumberOfFilesAndFolders(pathItems, props.path)
  return loaded ? (
    <Kb.Text type="BodySmall">
      {folders ? `${folders} ${pluralize('Folder')}${files ? ', ' : ''}` : undefined}
      {files ? `${files} ${pluralize('File')}` : undefined}
    </Kb.Text>
  ) : (
    <Kb.ProgressIndicator />
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

const SoftErrorBanner = ({path}: {path: Types.Path}) => {
  const softError = useFsSoftError(path)
  switch (softError) {
    case null:
      return null
    case Types.SoftError.NoAccess:
      return <Kb.Banner color="blue">You don't have access to this folder or file.</Kb.Banner>
    case Types.SoftError.Nonexistent:
      return <Kb.Banner color="yellow">This file or folder doesn't exist.</Kb.Banner>
  }
}

const PathItemInfo = (props: Props) => {
  useFsOnlineStatus() // when used in chat, we don't have this from Files tab
  useFsPathMetadata(props.path)
  const pathItem = Container.useSelector(state => Constants.getPathItem(state.fs.pathItems, props.path))
  const name = (
    <CommaSeparatedName
      center={true}
      type="BodySmallSemibold"
      name={Types.getPathName(props.path)}
      elementStyle={styles.stylesNameText}
    />
  )
  return (
    <>
      <SoftErrorBanner path={props.path} />
      <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true} style={props.containerStyle}>
        <ItemIcon path={props.path} size={48} style={styles.pathItemIcon} />
        <Kb.Box style={styles.nameTextBox}>{name}</Kb.Box>
        {pathItem.type === Types.PathType.File && (
          <Kb.Text type="BodySmall">{Constants.humanReadableFileSize(pathItem.size)}</Kb.Text>
        )}
        {Constants.isInTlf(props.path) && Constants.isFolder(props.path, pathItem) && (
          <FilesAndFoldersCount {...props} />
        )}
        {getTlfInfoLineOrLastModifiedLine(props.path)}
      </Kb.Box2>
    </>
  )
}

export default PathItemInfo

const styles = Styles.styleSheetCreate(
  () =>
    ({
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
    } as const)
)
