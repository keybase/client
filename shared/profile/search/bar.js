// @flow
import React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import flags from '../../util/feature-flags'
import Search from './container'

type Props = {||}
type State = {|show: boolean|}

class ProfileSearch extends React.PureComponent<Props, State> {
  state = {show: false}

  _ref = React.createRef()
  _onShow = () => this.setState({show: true})
  _onHide = () => this.setState({show: false})
  _getAttachmentRef = () => this._ref.current
  render() {
    return (
      <Kb.Box2 alignSelf="flex-end" direction="vertical" ref={this._ref}>
        <Kb.ClickableBox
          onClick={this._onShow}
          style={Styles.collapseStyles([styles.searchContainer, this.state.show && {opacity: 0}])}
        >
          <Kb.Icon
            color={Styles.globalColors.black_50}
            fontSize={Styles.isMobile ? 20 : 16}
            style={styles.searchIcon}
            type="iconfont-search"
          />
          <Kb.Text style={styles.searchText} type="BodySemibold">
            Search people
          </Kb.Text>
        </Kb.ClickableBox>
        <Kb.Overlay
          visible={this.state.show}
          onHidden={this._onHide}
          attachTo={this._getAttachmentRef}
          position="top left"
          style={styles.overlay}
        >
          <Search onClose={this._onHide} />
        </Kb.Overlay>
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  overlay: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.boxShadow,
      ...Styles.globalStyles.flexBoxColumn,
      alignSelf: 'center',
      backgroundColor: Styles.globalColors.white,
      borderRadius: 5,
      marginRight: 12,
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
      height: 24,
      marginLeft: flags.useNewRouter ? 'auto' : Styles.globalMargins.small,
      marginRight: flags.useNewRouter ? Styles.globalMargins.xsmall : Styles.globalMargins.small,
      marginTop: flags.useNewRouter ? 0 : Styles.globalMargins.xsmall,
      width: 240,
    },
    isMobile: {
      height: 32,
      width: '100%',
    },
  }),
  searchIcon: {
    paddingRight: Styles.globalMargins.tiny,
    position: 'relative',
    top: 1,
  },
  searchText: {
    color: Styles.globalColors.black_50,
    maxWidth: flags.useNewRouter ? 240 : undefined,
  },
})

export default ProfileSearch
