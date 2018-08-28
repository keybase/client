// @flow
import * as React from 'react'
import * as Styles from '../../../styles'
import ResultsList from '../../../search/results-list/container'
import UserInput from '../../../search/user-input/container'
import {Box2} from '../../../common-adapters'
import {ParticipantsRow} from '../../common'

export type Props = {|
  onClick: (username: string) => void,
  onClose: () => void,
  onShowTracker: (username: string) => void,
|}

const searchKey = 'walletSearch'
const placeholder = 'Search Keybase'

// TODO: Once UserInput is cleaned up, we may be able to stretch it
// properly horizontally without wrapping a vertical Box2 around it.
const Search = (props: Props) => (
  <React.Fragment>
    <ParticipantsRow heading="To" style={styles.row}>
      <Box2 direction="vertical" fullWidth={true}>
        <UserInput
          searchKey={searchKey}
          autoFocus={true}
          placeholder={placeholder}
          onExitSearch={props.onClose}
          disableListBuilding={true}
          showServiceFilter={false}
        />
      </Box2>
    </ParticipantsRow>
    <ResultsList
      searchKey={searchKey}
      onClick={props.onClick}
      onShowTracker={props.onShowTracker}
      disableListBuilding={true}
      style={styles.list}
    />
  </React.Fragment>
)

const styles = Styles.styleSheetCreate({
  row: {
    paddingBottom: 0,
  },
  list: {
    position: 'absolute',
    top: 100,
    zIndex: 4,
    backgroundColor: Styles.globalColors.white,
    width: '100%',
  },
})

export default Search
