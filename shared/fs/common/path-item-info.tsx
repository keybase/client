import * as C from '../../constants'
import * as Constants from '../../constants/fs'
import * as T from '../../constants/types'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import LastModifiedLine from './last-modified-line-container'
import TlfInfoLine from './tlf-info-line-container'
import ItemIcon from './item-icon'
import CommaSeparatedName from './comma-separated-name'
import {pluralize} from '../../util/string'
import {useFsChildren, useFsPathMetadata, useFsOnlineStatus, useFsSoftError} from './hooks'

type Props = {
  containerStyle?: Styles.StylesCrossPlatform
  path: T.FS.Path
}

const getNumberOfFilesAndFolders = (
  pathItems: T.FS.PathItems,
  path: T.FS.Path
): {folders: number; files: number; loaded: boolean} => {
  const pathItem = C.getPathItem(pathItems, path)
  return pathItem.type === T.FS.PathType.Folder
    ? [...pathItem.children].reduce(
        ({folders, files, loaded}, p) => {
          const item = C.getPathItem(pathItems, T.FS.pathConcat(path, p))
          const isFolder = item.type === T.FS.PathType.Folder
          const isFile = item.type !== T.FS.PathType.Folder && item !== Constants.unknownPathItem
          return {
            files: files + (isFile ? 1 : 0),
            folders: folders + (isFolder ? 1 : 0),
            loaded,
          }
        },
        {files: 0, folders: 0, loaded: pathItem.progress === T.FS.ProgressType.Loaded}
      )
    : {files: 0, folders: 0, loaded: false}
}

const FilesAndFoldersCount = (props: Props) => {
  useFsChildren(props.path)
  const pathItems = C.useFSState(s => s.pathItems)
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

const getTlfInfoLineOrLastModifiedLine = (path: T.FS.Path) => {
  switch (T.FS.getPathLevel(path)) {
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

const SoftErrorBanner = ({path}: {path: T.FS.Path}) => {
  const softError = useFsSoftError(path)
  switch (softError) {
    case undefined:
      return null
    case T.FS.SoftError.NoAccess:
      return <Kb.Banner color="blue">You don't have access to this folder or file.</Kb.Banner>
    case T.FS.SoftError.Nonexistent:
      return <Kb.Banner color="yellow">This file or folder doesn't exist.</Kb.Banner>
  }
}

const PathItemInfo = (props: Props) => {
  useFsOnlineStatus() // when used in chat, we don't have this from Files tab
  useFsPathMetadata(props.path)
  const pathItem = C.useFSState(s => C.getPathItem(s.pathItems, props.path))
  const name = (
    <CommaSeparatedName
      center={true}
      type="BodySmallSemibold"
      name={T.FS.getPathName(props.path)}
      elementStyle={styles.stylesNameText}
    />
  )
  return (
    <>
      <SoftErrorBanner path={props.path} />
      <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true} style={props.containerStyle}>
        <ItemIcon path={props.path} size={48} style={styles.pathItemIcon} />
        <Kb.Box style={styles.nameTextBox}>{name}</Kb.Box>
        {pathItem.type === T.FS.PathType.File && (
          <Kb.Text type="BodySmall">{C.humanReadableFileSize(pathItem.size)}</Kb.Text>
        )}
        {Constants.isInTlf(props.path) && C.isFolder(props.path, pathItem) && (
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
    }) as const
)
