// @flow
import React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import flags from '../../util/feature-flags'
import Search from './container'

type Props = {|onSearch: () => void, whiteText?: boolean|}
type State = {|show: boolean|}

class ProfileSearch extends React.PureComponent<Props, State> {
  state = {show: false}

  _ref = React.createRef()
  _onShow = () => {
    this.setState({show: true})
    this.props.onSearch()
  }
  _onHide = () => this.setState({show: false})
  _getAttachmentRef = () => this._ref.current
  render() {
    return (
      <Kb.Box2 style={styles.container} direction="horizontal" ref={this._ref}>
        <Kb.ClickableBox
          onClick={this._onShow}
          style={Styles.collapseStyles([styles.searchContainer, this.state.show && {opacity: 0}])}
        >
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
          position={flags.useNewRouter ? 'top left' : 'top center'}
          style={styles.overlay}
        >
          <Search onClose={this._onHide} />
        </Kb.Overlay>
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  colorWhite: {
    color: Styles.globalColors.white_75,
  },
  container: {
    ...(flags.useNewRouter ? {alignSelf: 'flex-end', flexGrow: 1} : {alignSelf: 'center'}),
  },
  overlay: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.boxShadow,
      ...Styles.globalStyles.flexBoxColumn,
      ...Styles.desktopStyles.windowDraggingClickable,
      ...(flags.useNewRouter ? {marginRight: 12} : {}),
      alignSelf: 'center',
      borderRadius: 5,
      marginTop: -24,
      minWidth: 400,
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
      height: 24,
      marginLeft: flags.useNewRouter ? 'auto' : Styles.globalMargins.small,
      marginRight: flags.useNewRouter ? Styles.globalMargins.xsmall : Styles.globalMargins.small,
      marginTop: flags.useNewRouter ? 0 : Styles.globalMargins.xsmall,
      width: 240,
    },
    isMobile: {
      flexGrow: 1,
      padding: 4,
    },
  }),
  searchIcon: {paddingRight: Styles.globalMargins.tiny},
  searchText: {
    color: Styles.globalColors.black_50,
    maxWidth: flags.useNewRouter ? 240 : undefined,
  },
})

export default ProfileSearch
