// @flow
import {connect, type TypedState} from '../../util/container'
import React from 'react'
import {ProgressIndicator, Box} from '../../common-adapters'
import SearchResultsList from '.'
import * as SearchGen from '../../actions/search-gen'
import {globalMargins} from '../../styles'

type OwnProps = {
  searchKey: string,
  onShowTracker?: (id: string) => void,
  onClick?: (id: string) => void,
  disableListBuilding?: boolean,
  disableIfInTeamName?: ?string,
}

const mapStateToProps = ({entities}: TypedState, {disableIfInTeamName, searchKey}: OwnProps) => {
  const searchResultIds = entities.getIn(['search', 'searchKeyToResults', searchKey])
  const pending = entities.getIn(['search', 'searchKeyToPending', searchKey], false)
  const showSearchSuggestions = entities.getIn(
    ['search', 'searchKeyToShowSearchSuggestion', searchKey],
    false
  )
  const selectedId = entities.getIn(['search', 'searchKeyToSelectedId', searchKey])
  return {
    disableIfInTeamName,
    items: searchResultIds && searchResultIds.toArray(),
    pending,
    selectedId,
    showSearchSuggestions,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {searchKey, onClick, disableListBuilding}: OwnProps) => ({
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

const Chooser = props => (props.pending ? <Progress style={props.style} /> : <SearchResultsList {...props} />)
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Chooser)
