// @flow
import * as React from 'react'
import ResultsList from '../../search/results-list/container'
import UserInput from '../../search/user-input/container'
import {StandardScreen} from '../../common-adapters'
import {globalStyles} from '../../styles'

export type Props = {
  onClick: (username: string) => void,
  onClose: () => void,
  onShowTracker: (username: string) => void,
}

const searchKey = 'walletSearch'
const placeholder = 'Search Keybase'

const Search = (props: Props) => (
  <StandardScreen style={styleContainer} onCancel={props.onClose} title="Wallet search">
    <UserInput
      searchKey={searchKey}
      autoFocus={true}
      placeholder={placeholder}
      onExitSearch={props.onClose}
      disableListBuilding={true}
      disableServiceFilter={true}
    />
    <ResultsList
      searchKey={searchKey}
      onClick={props.onClick}
      onShowTracker={props.onShowTracker}
      disableListBuilding={true}
    />
  </StandardScreen>
)

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  // StandardScreen supplies padding we don't want.
  paddingTop: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  paddingRight: 0,
}

export default Search
