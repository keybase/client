// @flow
import People from './'
import * as PeopleGen from '../actions/people-gen'
import {connect} from 'react-redux'
import {compose, lifecycle} from 'recompose'
import {type TypedState} from '../util/container'
import {createSearchSuggestions} from '../actions/search-gen'
import {navigateAppend} from '../actions/route-tree'
import {isMobile} from '../constants/platform'
import {createShowUserProfile} from '../actions/profile-gen'
import {createGetProfile} from '../actions/tracker-gen'
// import flags from '../util/feature-flags'

const mapStateToProps = (state: TypedState) => ({
  newItems: state.people.newItems,
  oldItems: state.people.oldItems,
  followSuggestions: state.people.followSuggestions,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  getData: () => dispatch(PeopleGen.createGetPeopleData({markViewed: true, numFollowSuggestionsWanted: 10})),
  todoDispatch: {},
  onSearch: () => {
    dispatch(createSearchSuggestions({searchKey: 'profileSearch'}))
    dispatch(navigateAppend([{props: {}, selected: 'search'}]))
  },
  onClickUser: (username: string) =>
    isMobile
      ? dispatch(createShowUserProfile({username}))
      : dispatch(createGetProfile({username, ignoreCache: true, forceDisplay: true})),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentWillMount() {
      this.props.getData()
    },
  })
)(People)
