// @flow
import People from './'
import * as PeopleGen from '../actions/people-gen'
import * as Types from '../constants/types/people'
import * as Tabs from '../constants/tabs'
import {connect} from 'react-redux'
import {compose} from 'recompose'
import {type TypedState} from '../util/container'
import {createSearchSuggestions} from '../actions/search-gen'
import {navigateAppend, switchTo} from '../actions/route-tree'
import {createShowUserProfile} from '../actions/profile-gen'
import openURL from '../util/open-url'
// import flags from '../util/feature-flags'

const INSTALL_LINK_URL = 'https://keybase.io/download'

const mapStateToProps = (state: TypedState) => ({
  newItems: state.people.newItems,
  oldItems: state.people.oldItems,
  followSuggestions: state.people.followSuggestions,
})

const onSkipTodo = (type: Types.TodoType, dispatch: Dispatch) => () =>
  dispatch(PeopleGen.createSkipTodo({type}))

const mapDispatchToProps = (dispatch: Dispatch) => ({
  getData: () => dispatch(PeopleGen.createGetPeopleData({markViewed: true, numFollowSuggestionsWanted: 10})),
  todoDispatch: {
    bio: {
      onConfirm: (username: string) => dispatch(createShowUserProfile({username})),
      onDismiss: () => {},
    },
    proof: {
      onConfirm: (username: string) => dispatch(createShowUserProfile({username})),
      onDismiss: onSkipTodo('proof', dispatch),
    },
    device: {
      onConfirm: () => openURL(INSTALL_LINK_URL),
      onDismiss: onSkipTodo('device', dispatch),
    },
    follow: {
      onConfirm: () => dispatch(navigateAppend(['search', Tabs.peopleTab])),
      onDismiss: onSkipTodo('follow', dispatch),
    },
    chat: {
      onConfirm: () => dispatch(switchTo([Tabs.chatTab])),
      onDismiss: () => onSkipTodo('chat', dispatch),
    },
  },
  onSearch: () => {
    dispatch(createSearchSuggestions({searchKey: 'profileSearch'}))
    dispatch(navigateAppend([{props: {}, selected: 'search'}]))
  },
  onClickUser: (username: string) => dispatch(createShowUserProfile({username})),
})

export default compose(connect(mapStateToProps, mapDispatchToProps))(People)
