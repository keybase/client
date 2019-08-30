import * as React from 'react'
import ResultsList from '../../search/results-list/container'
import UserInput from '../../search/user-input/container'
import * as Kb from '../../common-adapters/mobile.native'
import * as Styles from '../../styles'
import {Props} from '.'
import {searchKey, placeholder} from './index.shared'

const Search = (props: Props) => {
  const search = (
    <Kb.StandardScreen style={styleContainer} onCancel={props.onClose} title="Search people">
      <UserInput
        searchKey={searchKey}
        onExitSearch={props.onClose}
        autoFocus={true}
        placeholder={placeholder}
        showServiceFilter={true}
      />
      <ResultsList searchKey={searchKey} onClick={props.onClick} disableListBuilding={true} />
    </Kb.StandardScreen>
  )

  if (Styles.isAndroid) {
    return search
  }

  return <Kb.SafeAreaViewTop>{search}</Kb.SafeAreaViewTop>
}

const styleContainer = {
  // StandardScreen supplies padding we don't want.
  backgroundColor: Styles.globalColors.white,
  paddingBottom: 0,
  paddingLeft: 0,
  paddingRight: 0,
  paddingTop: 0,
}

export default Search
