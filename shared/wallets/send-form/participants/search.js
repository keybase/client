// @flow
import * as React from 'react'
import * as Styles from '../../../styles'
import ResultsList from '../../../search/results-list/container'
import UserInput from '../../../search/user-input/container'
import {Box2} from '../../../common-adapters'
import {ParticipantsRow} from '../../common'
import {searchKey} from '../../../constants/wallets'

export type SearchProps = {|
  onClickResult: (username: string) => void,
  onClose: () => void,
  onShowSuggestions: () => void,
  onShowTracker: (username: string) => void,
|}

type SearchState = {|
  displayResultsList: boolean,
  hideClearSearch: boolean,
|}

const placeholder = 'Search Keybase'

// TODO: Once UserInput is cleaned up, we may be able to stretch it
// properly horizontally without wrapping a vertical Box2 around it.
class Search extends React.Component<SearchProps, SearchState> {
  state = {
    displayResultsList: false,
    hideClearSearch: true,
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
  }

  closeResultsList = () => this.setState({displayResultsList: false, hideClearSearch: true})

  render() {
    return (
      <React.Fragment>
        <ParticipantsRow heading="To" style={styles.row} headingStyle={styles.rowHeading}>
          <Box2 direction="vertical" fullWidth={true}>
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
          </Box2>
        </ParticipantsRow>
        {this.state.displayResultsList && (
          <ResultsList
            searchKey={searchKey}
            onClick={this.props.onClickResult}
            onShowTracker={this.props.onShowTracker}
            disableListBuilding={true}
            style={styles.list}
          />
        )}
      </React.Fragment>
    )
  }
}

const styles = Styles.styleSheetCreate({
  row: {
    paddingBottom: 0,
    paddingTop: 0,
  },
  rowHeading: {
    marginRight: 0, // Removing the right margin on the heading is to offset some left margin in UserInput
  },
  input: {
    borderWidth: 0,
    paddingLeft: 0,
  },
  list: Styles.platformStyles({
    isElectron: {
      position: 'absolute',
      top: 93, // This is the exact height of the header + the input + the divider
      zIndex: 4,
      backgroundColor: Styles.globalColors.white,
      height: 432, // 525 (height of popup) - 93
      width: '100%',
      overflowY: 'scroll',
    },
  }),
})

export default Search
