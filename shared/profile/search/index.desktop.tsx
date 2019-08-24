import * as React from 'react'
import SearchResultsList from '../../search/results-list/container'
import UserInput from '../../search/user-input/container'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {Props} from '.'
import {searchKey, placeholder} from './index.shared'

const Search = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={{backgroundColor: Styles.globalColors.white}}>
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <UserInput
        disableListBuilding={true}
        searchKey={searchKey}
        onSelectUser={props.onClick}
        onExitSearch={props.onClose}
        autoFocus={true}
        placeholder={placeholder}
        showServiceFilter={true}
      />
    </Kb.Box2>
    <SearchResultsList
      style={{minHeight: 360, overflow: 'auto'}}
      searchKey={searchKey}
      onClick={props.onClick}
      disableListBuilding={true}
    />
  </Kb.Box2>
)

export default Search
