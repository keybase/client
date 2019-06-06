import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as Styles from '../../../styles'
import * as Kb from '../../../common-adapters'
import TlfOrPathItemInfo from '../tlf-or-path-item-info'
import PathItemIcon from '../path-item-icon-container'
import CommaSeparatedName from '../comma-separated-name'

export type Props = {
  size: number
  type: Types.PathType
  childrenFolders: number
  childrenFiles: number
  path: Types.Path
  loadFolderList: () => void
  loadPathMetadata: () => void
}

class Header extends React.PureComponent<Props> {
  refresh = () => {
    this.props.loadPathMetadata()
    // need this to get chlidren file/folder count
    this.props.type === Types.PathType.Folder &&
      Types.getPathLevel(this.props.path) >= 3 &&
      this.props.loadFolderList()
  }
  componentDidMount() {
    this.refresh()
  }
  componentDidUpdate(prevProps: Props) {
    this.props.path !== prevProps.path && this.refresh()
  }
  _filesAndFoldersCount() {
    return (
      this.props.type === Types.PathType.Folder && (
        <Kb.Text type="BodySmall">
          {this.props.childrenFolders
            ? `${this.props.childrenFolders} Folder${this.props.childrenFolders > 1 ? 's' : ''}${
                this.props.childrenFiles ? ', ' : ''
              }`
            : undefined}
          {this.props.childrenFiles
            ? `${this.props.childrenFiles} File${this.props.childrenFiles > 1 ? 's' : ''}`
            : undefined}
        </Kb.Text>
      )
    )
  }
  render() {
    return (
      <Kb.Box
        onClick={
          // This box is necessary as otherwise the click event propagates into
          // the ListItem2 backed row.
          event => event.stopPropagation()
        }
      >
        <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true} style={styles.container}>
          <PathItemIcon path={this.props.path} size={48} style={styles.pathItemIcon} />
          <Kb.WithTooltip
            containerStyle={styles.nameTextBox}
            text={Types.pathToString(this.props.path)}
            multiline={true}
            showOnPressMobile={true}
          >
            <CommaSeparatedName
              type="BodySmallSemibold"
              name={Types.getPathName(this.props.path)}
              elementStyle={styles.stylesNameText}
            />
          </Kb.WithTooltip>
          {this.props.type === Types.PathType.File && (
            <Kb.Text type="BodySmall">{Constants.humanReadableFileSize(this.props.size)}</Kb.Text>
          )}
          {this._filesAndFoldersCount()}
          <TlfOrPathItemInfo path={this.props.path} mode="menu" />
        </Kb.Box2>
      </Kb.Box>
    )
  }
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
