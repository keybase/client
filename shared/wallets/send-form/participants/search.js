// @flow
import * as React from 'react'
import * as Styles from '../../../styles'
import * as Kb from '../../../common-adapters'
import ResultsList from '../../../search/results-list/container'
import UserInput from '../../../search/user-input/container'
import {ParticipantsRow} from '../../common'
import {searchKey} from '../../../constants/wallets'

export type SearchProps = {|
  onClickResult: (username: string) => void,
  onClose: () => void,
  onShowSuggestions: () => void,
  onShowTracker: (username: string) => void,
  onScanQRCode: ?() => void,
|}

type SearchState = {|
  displayResultsList: boolean,
  hideClearSearch: boolean,
  searchText: string,
|}

const placeholder = 'Search Keybase'

// TODO: Once UserInput is cleaned up, we may be able to stretch it
// properly horizontally without wrapping a vertical Box2 around it.
class Search extends React.Component<SearchProps, SearchState> {
  _row: ?ParticipantsRow
  state = {
    displayResultsList: false,
    hideClearSearch: true,
    searchText: '',
  }

  componentDidMount() {
    this.props.onShowSuggestions()
  }

  onFocus = () => {
    this.setState({
      displayResultsList: true,
      hideClearSearch: false,
    })
  }

  onChangeSearchText = (text: string) => {
    if (text) {
      this.setState({hideClearSearch: true})
    }
    this.setState({searchText: text})
  }

  closeResultsList = () => this.setState({displayResultsList: false, hideClearSearch: true})

  _setRef = r => (this._row = r)
  _getRef = () => this._row

  render() {
    return (
      <React.Fragment>
        <ParticipantsRow ref={this._setRef} heading="To" style={styles.row} headingStyle={styles.rowHeading}>
          <Kb.Box2 direction="horizontal" fullWidth={true}>
            <UserInput
              disableListBuilding={true}
              onExitSearch={this.closeResultsList}
              onFocus={this.onFocus}
              onChangeSearchText={this.onChangeSearchText}
              placeholder={placeholder}
              searchKey={searchKey}
              hideClearSearch={this.state.hideClearSearch}
              showServiceFilter={false}
              style={styles.input}
            />
            {!this.state.searchText &&
              this.props.onScanQRCode && (
                <Kb.Icon
                  color={Styles.globalColors.black_40}
                  type="iconfont-qr-code"
                  fontSize={24}
                  onClick={this.props.onScanQRCode}
                  style={Kb.iconCastPlatformStyles(styles.qrCode)}
                />
              )}
          </Kb.Box2>
        </ParticipantsRow>
        {this.state.displayResultsList && (
          <Kb.FloatingBox attachTo={this._getRef} position="top center" propagateOutsideClicks={true}>
            <Kb.Box2 direction="vertical" style={styles.resultsFloatingContainer}>
              <Kb.Box2 direction="vertical" style={styles.resultsContainer}>
                <ResultsList
                  searchKey={searchKey}
                  onClick={this.props.onClickResult}
                  onShowTracker={this.props.onShowTracker}
                  disableListBuilding={true}
                  style={styles.list}
                />
              </Kb.Box2>
            </Kb.Box2>
          </Kb.FloatingBox>
        )}
      </React.Fragment>
    )
  }
}

const styles = Styles.styleSheetCreate({
  resultsFloatingContainer: Styles.platformStyles({
    isElectron: {
      borderBottomLeftRadius: 4,
      borderBottomRightRadius: 4,
      height: 429,
      overflow: 'hidden',
      width: 360,
    },
    isMobile: {
      flexGrow: 1,
      paddingTop: 98,
      width: '100%',
    },
  }),
  resultsContainer: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.white,
      height: '100%',
      width: '100%',
    },
    isElectron: {
      marginLeft: 1,
      overflowY: 'auto',
    },
  }),
  row: {
    minHeight: 48,
    paddingBottom: 0,
    paddingTop: 0,
  },
  rowHeading: {
    marginRight: 0, // Removing the right margin on the heading is to offset some left margin in UserInput
  },
  input: {
    alignSelf: 'center',
    flexGrow: 1,
    borderWidth: 0,
    borderBottomWidth: 0,
    paddingLeft: 0,
  },
  list: {
    height: '100%',
    width: '100%',
  },

  qrCode: {
    alignSelf: 'center',
    marginRight: Styles.globalMargins.tiny,
  },
})

export default Search
