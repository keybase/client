// @flow
import * as React from 'react'
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

const Search = (props: Props) => (
  <Box2 direction="vertical">
    <Box2 direction="horizontal" fullWidth={true} style={{alignItems: 'center'}}>
      <Text type="Body">To:</Text>
      {/* TODO: Get rid of singleton box below */}
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

export default Search
