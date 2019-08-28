import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as Styles from '../../../styles'
import * as Kb from '../../../common-adapters'
import LastModifiedLine from '../last-modified-line-container'
import TlfInfoLine from '../tlf-info-line-container'
import PathItemIcon from '../path-item-icon-container'
import CommaSeparatedName from '../comma-separated-name'
import {useFsChildren, useFsPathMetadata, useFsOnlineStatus} from '../hooks'

export type Props = {
  size: number
  type: Types.PathType
  childrenFolders: number
  childrenFiles: number
  noTooltip?: boolean
  path: Types.Path
}

const FilesAndFoldersCount = (props: Props) => {
  useFsChildren(props.path)
  return (
    <Kb.Text type="BodySmall">
      {props.childrenFolders
        ? `${props.childrenFolders} Folder${props.childrenFolders > 1 ? 's' : ''}${
            props.childrenFiles ? ', ' : ''
          }`
        : undefined}
      {props.childrenFiles ? `${props.childrenFiles} File${props.childrenFiles > 1 ? 's' : ''}` : undefined}
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

const Header = (props: Props) => {
  useFsOnlineStatus() // when used in chat, we don't have this from Files tab
  useFsPathMetadata(props.path)
  const name = (
    <CommaSeparatedName
      center={true}
      type="BodySmallSemibold"
      name={Types.getPathName(props.path)}
      elementStyle={styles.stylesNameText}
    />
  )
  return (
    <Kb.Box
      onClick={
        // This box is necessary as otherwise the click event propagates into
        // the ListItem2 backed row.
        event => event.stopPropagation()
      }
    >
      <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true} style={styles.container}>
        <PathItemIcon path={props.path} size={48} style={styles.pathItemIcon} />
        {props.noTooltip ? (
          <Kb.Box style={styles.nameTextBox}>{name}</Kb.Box>
        ) : (
          <Kb.WithTooltip
            containerStyle={styles.nameTextBox}
            text={Types.pathToString(props.path)}
            multiline={true}
            showOnPressMobile={true}
          >
            {name}
          </Kb.WithTooltip>
        )}
        {props.type === Types.PathType.File && (
          <Kb.Text type="BodySmall">{Constants.humanReadableFileSize(props.size)}</Kb.Text>
        )}
        {props.type === Types.PathType.Folder && <FilesAndFoldersCount {...props} />}
        {getTlfInfoLineOrLastModifiedLine(props.path)}
      </Kb.Box2>
    </Kb.Box>
  )
}

export default Header

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    common: {
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
      paddingTop: Styles.globalMargins.small,
    },
    isMobile: {
      paddingBottom: Styles.globalMargins.medium,
      paddingTop: Styles.globalMargins.large,
    },
  }),
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
