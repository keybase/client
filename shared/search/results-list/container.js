// @flow
import {connect, compose, setDisplayName, type TypedState} from '../../util/container'
import React from 'react'
import {ProgressIndicator, Box} from '../../common-adapters'
import SearchResultsList, {type Props as _Props} from '.'
import * as SearchGen from '../../actions/search-gen'
import {globalMargins} from '../../styles'

export type OwnProps = {|
  searchKey: string,
  onShowTracker?: (id: string) => void,
  onClick?: (id: string) => void,
  disableListBuilding?: boolean,
  disableIfInTeamName?: ?string,
  style?: any,
|}

const mapStateToProps = ({entities}: TypedState, {disableIfInTeamName, searchKey}: OwnProps) => {
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
  onMouseOver: id => dispatch(SearchGen.createUpdateSelectedSearchResult({searchKey, id})),
})

const Progress = ({style}) => (
  <Box style={style}>
    <ProgressIndicator style={styleSpinner} />
  </Box>
)

const styleSpinner = {
  alignSelf: 'center',
  marginTop: globalMargins.medium,
  marginBottom: globalMargins.medium,
  width: 24,
}

export type Props = _Props & {pending: boolean}

const Chooser = (props: any) =>
  props.pending ? <Progress style={props.style} /> : <SearchResultsList {...props} />

export default compose(
  // $FlowIssue
  connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d})),
  setDisplayName('ResultsList')
)(Chooser)
