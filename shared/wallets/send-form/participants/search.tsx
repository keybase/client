import * as React from 'react'
import * as Styles from '../../../styles'
import * as Kb from '../../../common-adapters'
import ResultsList from '../../../search/results-list/container'
import UserInput from '../../../search/user-input/container'
import {ParticipantsRow} from '../../common'
import {searchKey} from '../../../constants/wallets'

export type SearchProps = {
  heading: 'To' | 'From'
  onClickResult: (username: string) => void
  onShowSuggestions: () => void
  onShowTracker: (username: string) => void
  onScanQRCode: (() => void) | null
}

type SearchState = {
  displayResultsList: boolean
  hideClearSearch: boolean
  searchText: string
}

const placeholder = 'Search Keybase'

// TODO: Once UserInput is cleaned up, we may be able to stretch it
// properly horizontally without wrapping a vertical Box2 around it.
class Search extends React.Component<SearchProps, SearchState> {
  _row: ParticipantsRow | null = null
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

  _onScanQRCode = () => {
    this.closeResultsList()
    this.props.onScanQRCode && this.props.onScanQRCode()
  }

  _setRef = r => (this._row = r)
  _getRef = () => this._row

  render() {
    return (
      <React.Fragment>
        <ParticipantsRow
          ref={this._setRef}
          heading={this.props.heading}
          style={styles.row}
          headingStyle={styles.rowHeading}
        >
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
            {!this.state.searchText && this.props.onScanQRCode && (
              <Kb.Icon
                color={Styles.globalColors.black_50}
                type="iconfont-qr-code"
                fontSize={24}
                onClick={this._onScanQRCode}
                style={Kb.iconCastPlatformStyles(styles.qrCode)}
              />
            )}
          </Kb.Box2>
        </ParticipantsRow>
        {this.state.displayResultsList && (
          <Kb.FloatingBox
            attachTo={this._getRef}
            position="bottom center"
            positionFallbacks={[]}
            propagateOutsideClicks={true}
          >
            {/* If changing layout here, make sure to test on a notched and un-notched iphone and android */}
            {Styles.isIOS && <Kb.SafeAreaViewTop style={styles.backgroundColorPurple} />}
            <Kb.Box pointerEvents="box-none" style={styles.resultsFloatingContainer}>
              <Kb.Box2 direction="vertical" style={styles.resultsFloatingInnerContainer}>
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
            </Kb.Box>
          </Kb.FloatingBox>
        )}
      </React.Fragment>
    )
  }
}

const styles = Styles.styleSheetCreate({
  backgroundColorPurple: {backgroundColor: Styles.globalColors.purpleDark},
  input: {
    alignSelf: 'center',
    borderBottomWidth: 0,
    borderWidth: 0,
    flexGrow: 1,
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
  resultsFloatingContainer: Styles.platformStyles({
    isMobile: {marginTop: 96},
  }),
  resultsFloatingInnerContainer: Styles.platformStyles({
    isElectron: {
      borderBottomLeftRadius: 4,
      borderBottomRightRadius: 4,
      height: 560 - 96,
      overflow: 'hidden',
      width: 400,
    },
    isMobile: {
      flexGrow: 1,
      width: '100%',
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
})

const SendFormParticipantsSearch = Search
export default SendFormParticipantsSearch
