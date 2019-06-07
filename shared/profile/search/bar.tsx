import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import Search from './container'

type Props = {
  onSearch: () => void
  style?: Styles.StylesCrossPlatform
  whiteText?: boolean
}

type State = {
  show: boolean
}

class ProfileSearch extends React.PureComponent<Props, State> {
  state = {show: false}

  _ref: React.RefObject<Kb.Box2> = React.createRef()
  _onShow = () => {
    this.setState({show: true})
    this.props.onSearch()
  }
  _onHide = () => this.setState({show: false})
  _getAttachmentRef = () => this._ref.current
  render() {
    return (
      <Kb.Box2
        style={Styles.collapseStyles([styles.container, this.props.style])}
        direction="horizontal"
        ref={this._ref}
      >
        <Kb.ClickableBox onClick={this._onShow} style={Styles.collapseStyles([styles.searchContainer])}>
          <Kb.Box2 direction="horizontal" alignItems="center">
            <Kb.Icon
              color={this.props.whiteText ? Styles.globalColors.white_75 : Styles.globalColors.black_50}
              fontSize={Styles.isMobile ? 20 : 16}
              style={styles.searchIcon}
              type="iconfont-search"
            />
            <Kb.Text
              style={Styles.collapseStyles([styles.searchText, this.props.whiteText && styles.colorWhite])}
              type="BodySemibold"
            >
              Search{Styles.isMobile ? '' : ' people'}
            </Kb.Text>
          </Kb.Box2>
        </Kb.ClickableBox>
        <Kb.Overlay
          dest="keyboard-avoiding-root"
          visible={this.state.show}
          onHidden={this._onHide}
          attachTo={this._getAttachmentRef}
          matchDimension={true}
          position={undefined}
          positionFallbacks={[]}
          style={styles.overlay}
        >
          <Search onClose={this._onHide} />
        </Kb.Overlay>
      </Kb.Box2>
    )
  }
}

const searchContainerHeight = 32
const styles = Styles.styleSheetCreate({
  colorWhite: {color: Styles.globalColors.white_75},
  container: {width: '100%'},
  overlay: Styles.platformStyles({
    isElectron: {
      borderRadius: 5,
      marginLeft: Styles.globalMargins.xsmall,
      marginRight: Styles.globalMargins.xsmall,
      marginTop: -(searchContainerHeight + 8),
    },
  }),
  searchContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      alignSelf: 'center',
      backgroundColor: Styles.globalColors.black_10,
      borderRadius: Styles.borderRadius,
      justifyContent: 'center',
    },
    isElectron: {
      ...Styles.desktopStyles.clickable,
      ...Styles.desktopStyles.windowDraggingClickable,
      height: searchContainerHeight,
      justifyContent: 'flex-start',
      marginLeft: Styles.globalMargins.xsmall,
      marginRight: Styles.globalMargins.xsmall,
      marginTop: -Styles.globalMargins.xtiny,
      paddingLeft: Styles.globalMargins.xsmall,
      width: '100%',
    },
    isMobile: {
      flexGrow: 1,
      padding: 4,
    },
  }),
  searchIcon: {paddingRight: Styles.globalMargins.tiny},
  searchText: {
    color: Styles.globalColors.black_50,
    maxWidth: 240,
  },
})

export default ProfileSearch
