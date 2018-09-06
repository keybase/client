// @flow
import * as React from 'react'
import ResultsList from '../../search/results-list/container'
import UserInput from '../../search/user-input/container'
import {StandardScreen} from '../../common-adapters'
import {globalStyles} from '../../styles'
import type {Props} from '.'
import {searchKey, placeholder} from './index.shared'

const Search = (props: Props) => (
  <StandardScreen style={styleContainer} onCancel={props.onClose} title="Search people">
    <UserInput
      searchKey={searchKey}
      onExitSearch={props.onClose}
      autoFocus={true}
      placeholder={placeholder}
    />
    <ResultsList searchKey={searchKey} onClick={props.onClick} disableListBuilding={true} />
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
