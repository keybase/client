// @flow
import * as React from 'react'
import * as Creators from '../actions/chat/creators'
import UserInput from '../search/user-input/container'
import SearchResultsList from '../search/results-list/container'
import ServiceFilter from '../search/services-filter'
import {Box, Icon, ProgressIndicator, HeaderHoc} from '../common-adapters'
import {branch, compose, defaultProps, withPropsOnChange} from 'recompose'
import {connect} from 'react-redux'
import {globalMargins, globalStyles} from '../styles'
import {isMobile} from '../constants/platform'

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onExitSearch: () => dispatch(Creators.exitSearch()),
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
      <Icon
        type="iconfont-close"
        style={{height: 16, width: 16, marginRight: 10}}
        onClick={props.onExitSearch}
      />
    </Box>
    <Box style={{alignSelf: 'center'}}>
      {props.showServiceFilter &&
        <ServiceFilter selectedService={props.selectedService} onSelectService={props.onSelectService} />}
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
