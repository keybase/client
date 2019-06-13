import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'

export type TlfProps = {
  openInFilesTab: () => void
  isPublic: boolean
  isSelf: boolean
  text: string
}

const Tlf = (props: TlfProps) => (
  <Kb.ClickableBox onClick={props.openInFilesTab} style={styles.itemContainer}>
    <Kb.Icon
      type={props.isSelf ? 'iconfont-folder-public' /* has the little head */ : 'iconfont-folder-private'}
      color={Styles.globalColors.blue}
    />
    <Kb.Text type="BodyPrimaryLink" style={styles.itemText}>
      {props.text}
    </Kb.Text>
  </Kb.ClickableBox>
)

export type Props = {
  tlfs: Array<TlfProps>
  loadTlfs: () => void
}

export type State = {
  expanded: boolean
}

const numFoldersShown = 4

class Folders extends React.PureComponent<Props, State> {
  state = {
    expanded: false,
  }
  expand = () => this.setState({expanded: true})
  componentDidMount() {
    this.props.loadTlfs()
  }
  render() {
    return (
      <React.Fragment>
        {(this.state.expanded ? this.props.tlfs : this.props.tlfs.slice(0, numFoldersShown)).map(tlf => (
          <Tlf {...tlf} key={tlf.text} />
        ))}
        {!this.state.expanded && this.props.tlfs.length > numFoldersShown && (
          <Kb.ClickableBox key="more" onClick={this.expand} style={styles.itemContainer}>
            <Kb.Icon type="iconfont-ellipsis" />
            <Kb.Text type="BodySmall" style={styles.itemText}>
              + {this.props.tlfs.length - numFoldersShown} more
            </Kb.Text>
          </Kb.ClickableBox>
        )}
      </React.Fragment>
    )
  }
}

const styles = Styles.styleSheetCreate({
  itemContainer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'flex-start',
    paddingBottom: 4,
    paddingLeft: 8,
    paddingTop: 4,
  },
  itemText: Styles.platformStyles({
    common: {
      color: Styles.globalColors.black_50,
      marginLeft: Styles.globalMargins.tiny,
      overflow: 'hidden',
    },
    isElectron: {
      wordWrap: 'break-word',
    },
  }),
})

export default Folders
