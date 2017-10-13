// @flow
import {connect, type TypedState} from '../../util/container'
import React from 'react'
import {isMobile} from '../../constants/platform'
import {ProgressIndicator} from '../../common-adapters'
import SearchResultsList from '.'
import * as Creators from '../../actions/search/creators'
import {branch, compose, renderComponent} from 'recompose'
import {globalMargins} from '../../styles'

type OwnProps = {
  searchKey: string,
  onShowTracker: (id: string) => void,
  onClick?: (id: string) => void,
  disableListBuilding: boolean,
  disableIfInTeamName: ?string,
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
    showSearchSuggestions,
    selectedId,
    pending,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {searchKey, onClick, disableListBuilding}: OwnProps) => ({
  onClick: id => {
    !disableListBuilding && dispatch(Creators.addResultsToUserInput(searchKey, [id]))
    onClick && onClick(id)
  },
  onMouseOver: id => dispatch(Creators.updateSelectedSearchResult(searchKey, id)),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  branch(props => props.pending, renderComponent(() => <ProgressIndicator style={styleSpinner} />))
)(SearchResultsList)

const styleSpinner = isMobile
  ? {width: globalMargins.xlarge}
  : {
      alignSelf: 'center',
      marginTop: globalMargins.small,
      width: globalMargins.large,
    }
