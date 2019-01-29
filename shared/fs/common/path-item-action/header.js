// @flow
import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as Styles from '../../../styles'
import * as Kb from '../../../common-adapters'
import TlfOrPathItemInfo from '../tlf-or-path-item-info'
import PathItemIcon from '../path-item-icon-container'
import StaticBreadcrumb from '../static-breadcrumb'
import CommaSeparatedName from '../comma-separated-name'

type Props = {|
  size: number,
  type: Types.PathType,
  childrenFolders: number,
  childrenFiles: number,
  path: Types.Path,
  loadFolderList: () => void,
  loadMimeType: () => void,
|}

class Header extends React.PureComponent<Props> {
  refresh = () => {
    this.props.type === 'folder' && Types.getPathLevel(this.props.path) >= 3 && this.props.loadFolderList()
    this.props.type === 'file' && this.props.loadMimeType()
  }
  componentDidMount() {
    this.refresh()
  }
  componentDidUpdate(prevProps: Props) {
    this.props.path !== prevProps.path && this.refresh()
  }
  render() {
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true} style={styles.container}>
        <PathItemIcon path={this.props.path} size={32} style={styles.pathItemIcon} />
        <StaticBreadcrumb pathElements={Types.getPathElements(this.props.path)} />
        <Kb.Box2 direction="horizontal" style={styles.nameTextBox}>
          <CommaSeparatedName
            type="BodySmallSemibold"
            name={Types.getPathName(this.props.path)}
            elementStyle={Styles.collapseStyles([
              styles.stylesNameText,
              {color: Constants.getPathTextColor(this.props.path)},
            ])}
          />
        </Kb.Box2>
        {this.props.type === 'file' && (
          <Kb.Text type="BodySmall">{Constants.humanReadableFileSize(this.props.size)}</Kb.Text>
        )}
        {this.props.type === 'folder' && (
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
        )}
        <TlfOrPathItemInfo path={this.props.path} mode="default" />
      </Kb.Box2>
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
