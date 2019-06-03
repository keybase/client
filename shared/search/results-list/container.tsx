import {namedConnect} from '../../util/container'
import React from 'react'
import {ProgressIndicator, Box} from '../../common-adapters'
import SearchResultsList, {Props as _Props} from '.'
import * as SearchGen from '../../actions/search-gen'
import {globalMargins} from '../../styles'

export type OwnProps = {
  keyboardDismissMode?: 'none' | 'on-drag'
  searchKey: string
  onShowTracker?: (id: string) => void
  onClick?: (id: string) => void
  disableListBuilding?: boolean
  disableIfInTeamName?: string | null
  style?: any
}

const mapStateToProps = ({entities}, {disableIfInTeamName, searchKey}: OwnProps) => {
  const searchResultIds = entities.search.searchKeyToResults.get(searchKey)
  const pending = entities.search.searchKeyToPending.get(searchKey, false)
  const showSearchSuggestions = entities.search.searchKeyToShowSearchSuggestion.get(searchKey, false)
  const selectedId = entities.search.searchKeyToSelectedId.get(searchKey)
  return {
    disableIfInTeamName,
    items: searchResultIds && searchResultIds.toArray(),
    pending,
    selectedId,
    showSearchSuggestions,
  }
}

const mapDispatchToProps = (dispatch, {searchKey, onClick, disableListBuilding}: OwnProps) => ({
  onClick: (id: string) => {
    !disableListBuilding && dispatch(SearchGen.createAddResultsToUserInput({searchKey, searchResults: [id]}))
    onClick && onClick(id)
  },
  onMouseOver: id => dispatch(SearchGen.createUpdateSelectedSearchResult({id, searchKey})),
})

const Progress = ({style}) => (
  <Box style={style}>
    <ProgressIndicator style={styleSpinner} />
  </Box>
)

const styleSpinner = {
  alignSelf: 'center',
  marginBottom: globalMargins.medium,
  marginTop: globalMargins.medium,
  width: 24,
}

export type Props = _Props & {
  pending: boolean
}

const Chooser = (props: any) =>
  props.pending ? <Progress style={props.style} /> : <SearchResultsList {...props} />

export default namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d}),
  'ResultsList'
)(Chooser)
