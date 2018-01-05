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
  newItems: state.people.newItems.toJS(),
  oldItems: state.people.oldItems.toJS(),
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
    ...stateProps,
    ...dispatchProps,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(People)
