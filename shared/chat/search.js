// @flow
import * as React from 'react'
import * as Creators from '../actions/chat/creators'
import UserInput from '../search/user-input/container'
import SearchResultsList from '../search/results-list/container'
import {Box, ProgressIndicator, HeaderHoc} from '../common-adapters'
import {branch, compose, defaultProps, withPropsOnChange} from 'recompose'
import {connect} from 'react-redux'
import {globalMargins, globalStyles} from '../styles'
import {isMobile} from '../constants/platform'

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onExitSearch: () => dispatch(Creators.exitSearch(false)),
})

const SearchHeader = props => (
  <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', minHeight: 48}}>
      <Box style={{flex: 1, marginLeft: globalMargins.medium}}>
        <UserInput
          autoFocus={true}
          searchKey={'chatSearch'}
          placeholder={props.placeholder}
          onExitSearch={props.onExitSearch}
        />
      </Box>
    </Box>
    {props.showSearchPending
      ? <ProgressIndicator style={{width: globalMargins.large}} />
      : <SearchResultsList
          style={{flex: 1}}
          searchKey={'chatSearch'}
          onShowTracker={props.onShowTrackerInSearch}
        />}
  </Box>
)

export default compose(
  connect(undefined, mapDispatchToProps),
  branch(
    () => isMobile,
    compose(
      withPropsOnChange(['onExitSearch'], props => ({
        onCancel: () => props.onExitSearch(),
        title: 'New Chat',
      })),
      HeaderHoc
    )
  ),
  defaultProps({
    placeholder: 'Search for someone',
  })
)(SearchHeader)
