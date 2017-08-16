// @flow
import React from 'react'
import {connect} from 'react-redux'
import {List} from 'immutable'
import {isMobile} from '../../constants/platform'
import {ProgressIndicator} from '../../common-adapters'
import SearchResultsList from '.'
import * as Creators from '../../actions/search/creators'
import {branch, compose, renderComponent} from 'recompose'
import {globalMargins} from '../../styles'

import type {TypedState} from '../../constants/reducer'

type OwnProps = {
  searchKey: string,
  onShowTracker: (id: string) => void,
}

const mapStateToProps = ({entities}: TypedState, {searchKey}: OwnProps) => {
  const searchResultIds = entities.getIn(['searchKeyToResults', searchKey], List()).toArray()
  const pending = entities.getIn(['searchKeyToPending', searchKey], false)
  const showSearchSuggestions = entities.getIn(['searchKeyToShowSearchSuggestion', searchKey], false)
  const selectedId = entities.getIn(['searchKeyToSelectedId', searchKey])
  console.log('pending', pending)
  return {
    items: searchResultIds,
    showSearchSuggestions,
    selectedId,
    pending,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {searchKey}: OwnProps) => ({
  onClick: id => dispatch(Creators.addResultsToUserInput(searchKey, [id])),
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
