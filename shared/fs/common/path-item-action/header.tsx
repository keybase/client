import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as Styles from '../../../styles'
import * as Kb from '../../../common-adapters'
import TlfOrPathItemInfo from '../tlf-or-path-item-info'
import PathItemIcon from '../path-item-icon-container'
import CommaSeparatedName from '../comma-separated-name'
import {useFsChildren, useFsPathMetadata} from '../../common'

export type Props = {
  size: number
  type: Types.PathType
  childrenFolders: number
  childrenFiles: number
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

const Header = (props: Props) => {
  useFsPathMetadata(props.path)
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
        <Kb.WithTooltip
          containerStyle={styles.nameTextBox}
          text={Types.pathToString(props.path)}
          multiline={true}
          showOnPressMobile={true}
        >
          <CommaSeparatedName
            type="BodySmallSemibold"
            name={Types.getPathName(props.path)}
            elementStyle={styles.stylesNameText}
          />
        </Kb.WithTooltip>
        {props.type === Types.PathType.File && (
          <Kb.Text type="BodySmall">{Constants.humanReadableFileSize(props.size)}</Kb.Text>
        )}
        {props.type === Types.PathType.Folder && <FilesAndFoldersCount {...props} />}
        <TlfOrPathItemInfo path={props.path} mode="menu" />
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
