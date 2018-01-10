// @flow
import People from './'
import * as PeopleGen from '../actions/people-gen'
import {connect} from 'react-redux'
import {type TypedState} from '../util/container'
import {createSearchSuggestions} from '../actions/search-gen'
import {navigateAppend} from '../actions/route-tree'
import {createShowUserProfile} from '../actions/profile-gen'
import {getPeopleDataWaitingKey} from '../constants/people'

const mapStateToProps = (state: TypedState) => ({
  _newItems: state.people.newItems,
  _oldItems: state.people.oldItems,
  followSuggestions: state.people.followSuggestions.toJS(),
  myUsername: state.config.username,
  waiting: !!state.waiting.get(getPeopleDataWaitingKey),
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  getData: () => dispatch(PeopleGen.createGetPeopleData({markViewed: true, numFollowSuggestionsWanted: 10})),
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
    followSuggestions: stateProps.followSuggestions,
    myUsername: stateProps.myUsername,
    waiting: stateProps.waiting,
    ...dispatchProps,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(People)
