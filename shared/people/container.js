// @flow
import * as React from 'react'
import People from './'
import * as PeopleGen from '../actions/people-gen'
import {connect, type TypedState} from '../util/container'
import {createSearchSuggestions} from '../actions/search-gen'
import {navigateAppend} from '../actions/route-tree'
import {createShowUserProfile} from '../actions/profile-gen'
import {getPeopleDataWaitingKey} from '../constants/people'
import * as WaitingConstants from '../constants/waiting'
import type {Props} from '.'

class LoadOnMount extends React.Component<Props> {
  componentDidMount() {
    this.props.getData(false)
  }

  render() {
    return <People {...this.props} />
  }
}

const mapStateToProps = (state: TypedState) => ({
  _newItems: state.people.newItems,
  _oldItems: state.people.oldItems,
  followSuggestions: state.people.followSuggestions,
  myUsername: state.config.username,
  waiting: WaitingConstants.anyWaiting(state, getPeopleDataWaitingKey),
})

const mapDispatchToProps = dispatch => ({
  getData: (markViewed = true) =>
    dispatch(PeopleGen.createGetPeopleData({markViewed, numFollowSuggestionsWanted: 10})),
  onSearch: () => {
    dispatch(createSearchSuggestions({searchKey: 'profileSearch'}))
    dispatch(navigateAppend([{props: {}, selected: 'search'}]))
  },
  onClickUser: (username: string) => dispatch(createShowUserProfile({username})),
})

const mergeProps = (stateProps, dispatchProps) => {
  return {
    newItems: stateProps._newItems.toJS(),
    oldItems: stateProps._oldItems.toJS(),
    followSuggestions: stateProps.followSuggestions.toJS(),
    myUsername: stateProps.myUsername,
    waiting: stateProps.waiting,
    ...dispatchProps,
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
  // $FlowIssue TODO don't use toJS above, you lose all types
)(LoadOnMount)
