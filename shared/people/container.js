// @flow
import People from './'
import * as PeopleGen from '../actions/people-gen'
import * as Types from '../constants/types/people'
import * as Tabs from '../constants/tabs'
import * as SettingsTabs from '../constants/settings'
import {createGetMyProfile} from '../actions/tracker-gen'
import {connect} from 'react-redux'
import {type TypedState} from '../util/container'
import {createSearchSuggestions} from '../actions/search-gen'
import {navigateAppend, switchTo, navigateTo} from '../actions/route-tree'
import {createShowUserProfile} from '../actions/profile-gen'
import openURL from '../util/open-url'
import {isMobile} from '../constants/platform'
import {getPeopleDataWaitingKey} from '../constants/people'
// import flags from '../util/feature-flags'

const INSTALL_LINK_URL = 'https://keybase.io/download'

const mapStateToProps = (state: TypedState) => ({
  newItems: state.people.newItems,
  oldItems: state.people.oldItems,
  followSuggestions: state.people.followSuggestions,
  myUsername: state.config.username,
  waiting: !!state.waiting.get(getPeopleDataWaitingKey),
})

const onSkipTodo = (type: Types.TodoType, dispatch: Dispatch) => () =>
  dispatch(PeopleGen.createSkipTodo({type}))

const mapDispatchToProps = (dispatch: Dispatch) => ({
  getData: () => dispatch(PeopleGen.createGetPeopleData({markViewed: true, numFollowSuggestionsWanted: 10})),
  todoDispatch: {
    bio: {
      _onConfirm: (username: string) => {
        // make sure we have tracker state & profile is up to date
        dispatch(createGetMyProfile({}))
        dispatch(navigateAppend([{props: {username}, selected: 'profile'}, 'editProfile'], [Tabs.peopleTab]))
      },
      onDismiss: () => {},
    },
    proof: {
      _onConfirm: (username: string) => dispatch(createShowUserProfile({username})),
      onDismiss: onSkipTodo('proof', dispatch),
    },
    device: {
      onConfirm: () => openURL(INSTALL_LINK_URL),
      onDismiss: onSkipTodo('device', dispatch),
    },
    follow: {
      onConfirm: () => dispatch(navigateAppend(['search'], [Tabs.peopleTab])),
      onDismiss: onSkipTodo('follow', dispatch),
    },
    chat: {
      onConfirm: () => dispatch(switchTo([Tabs.chatTab])),
      onDismiss: onSkipTodo('chat', dispatch),
    },
    paperkey: {
      onConfirm: () => {
        if (!isMobile) {
          dispatch(switchTo([Tabs.devicesTab]))
        } else {
          dispatch(navigateTo([SettingsTabs.devicesTab], [Tabs.settingsTab]))
          dispatch(switchTo([Tabs.settingsTab]))
        }
      },
      onDismiss: () => {},
    },
    team: {
      onConfirm: () => {
        dispatch(navigateAppend(['showNewTeamDialog'], [Tabs.teamsTab]))
        dispatch(switchTo([Tabs.teamsTab]))
      },
      onDismiss: onSkipTodo('team', dispatch),
    },
    folder: {
      onConfirm: () => {
        if (!isMobile) {
          dispatch(navigateTo(['private'], [Tabs.folderTab]))
          dispatch(switchTo([Tabs.folderTab]))
        } else {
          dispatch(navigateTo([SettingsTabs.foldersTab, 'private'], [Tabs.settingsTab]))
          dispatch(switchTo([Tabs.settingsTab]))
        }
      },
      onDismiss: onSkipTodo('folder', dispatch),
    },
    gitRepo: {
      onConfirm: () => {
        dispatch(navigateTo([{selected: 'newRepo', props: {isTeam: false}}], [Tabs.gitTab]))
        dispatch(switchTo([Tabs.gitTab]))
      },
      onDismiss: onSkipTodo('gitRepo', dispatch),
    },
    teamShowcase: {
      onConfirm: () => {
        // TODO find a team that the current user is an admin of and nav there?
        dispatch(navigateTo([], [Tabs.teamsTab]))
        dispatch(switchTo([Tabs.teamsTab]))
      },
      onDismiss: onSkipTodo('teamShowcase', dispatch),
    },
  },
  onSearch: () => {
    dispatch(createSearchSuggestions({searchKey: 'profileSearch'}))
    dispatch(navigateAppend([{props: {}, selected: 'search'}]))
  },
  onClickUser: (username: string) => dispatch(createShowUserProfile({username})),
})

const mergeProps = (stateProps, dispatchProps) => {
  let todos = dispatchProps.todoDispatch
  todos = {
    ...todos,
    bio: {
      ...todos.bio,
      onConfirm: () => todos.bio._onConfirm(stateProps.myUsername),
    },
    proof: {
      ...todos.proof,
      onConfirm: () => todos.proof._onConfirm(stateProps.myUsername),
    },
  }
  return {
    ...stateProps,
    ...dispatchProps,
    todoDispatch: todos,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(People)
