// @flow
import * as React from 'react'
import {globalColors, globalMargins, styleSheetCreate} from '../../styles'
import ResultsList from '../../search/results-list/container'
import UserInput from '../../search/user-input/container'
import {Box2, Text} from '../../common-adapters'

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
  <Box2 direction="vertical">
    <Box2 direction="horizontal" fullWidth={true} style={styles.inputLine}>
      <Text style={styles.toText} type="Body">
        To:
      </Text>
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
    </Box2>
    <ResultsList
      searchKey={searchKey}
      onClick={props.onClick}
      onShowTracker={props.onShowTracker}
      disableListBuilding={true}
    />
  </Box2>
)

const styles = styleSheetCreate({
  toText: {color: globalColors.blue},
  inputLine: {alignItems: 'center', paddingLeft: globalMargins.small, paddingRight: globalMargins.small},
})

export default Search
