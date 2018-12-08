// @flow
import * as React from 'react'
import {Task} from '.'
import * as PeopleGen from '../../actions/people-gen'
import * as Types from '../../constants/types/people'
import * as Tabs from '../../constants/tabs'
import * as SettingsTabs from '../../constants/settings'
import type {IconType} from '../../common-adapters/icon.constants'
import {todoTypes} from '../../constants/people'
import {connect} from '../../util/container'
import {createGetMyProfile} from '../../actions/tracker-gen'
import {navigateAppend, switchTo, navigateTo} from '../../actions/route-tree'
import {createShowUserProfile} from '../../actions/profile-gen'
import openURL from '../../util/open-url'
import {isMobile} from '../../constants/platform'

type TodoOwnProps = {|
  badged: boolean,
  confirmLabel: string,
  dismissable: boolean,
  icon: IconType,
  instructions: string,
  todoType: Types.TodoType,
|}

const installLinkURL = 'https://keybase.io/download'
const onSkipTodo = (type: Types.TodoType, dispatch) => () => dispatch(PeopleGen.createSkipTodo({type}))
const mapStateToProps = state => ({myUsername: state.config.username || ''})

const AvatarTeamConnector = connect<TodoOwnProps, _, _, _, _>(
  mapStateToProps,
  dispatch => ({
    onConfirm: () => dispatch(switchTo([Tabs.teamsTab])),
    onDismiss: () => {},
  }),
  (stateProps, dispatchProps, ownProps) => ({
    ...ownProps,
    onConfirm: () => dispatchProps.onConfirm(),
    onDismiss: dispatchProps.onDismiss,
  })
)(Task)

const AvatarUserConnector = connect<TodoOwnProps, _, _, _, _>(
  mapStateToProps,
  dispatch => ({
    onConfirm: () => {
      // make sure we have tracker state & profile is up to date
      dispatch(createGetMyProfile({}))
      dispatch(switchTo([Tabs.profileTab, 'editAvatar']))
    },
    onDismiss: () => {},
  }),
  (stateProps, dispatchProps, ownProps) => ({
    ...ownProps,
    onConfirm: dispatchProps.onConfirm,
    onDismiss: dispatchProps.onDismiss,
  })
)(Task)

const BioConnector = connect<TodoOwnProps, _, _, _, _>(
  mapStateToProps,
  dispatch => ({
    _onConfirm: (username: string) => {
      // make sure we have tracker state & profile is up to date
      dispatch(createGetMyProfile({}))
      dispatch(navigateAppend(['editProfile'], [Tabs.peopleTab]))
    },
    onDismiss: () => {},
  }),
  (stateProps, dispatchProps, ownProps) => ({
    ...ownProps,
    onConfirm: () => dispatchProps._onConfirm(stateProps.myUsername),
    onDismiss: dispatchProps.onDismiss,
  })
)(Task)

const ProofConnector = connect<TodoOwnProps, _, _, _, _>(
  mapStateToProps,
  dispatch => ({
    _onConfirm: (username: string) => dispatch(createShowUserProfile({username})),
    onDismiss: onSkipTodo('proof', dispatch),
  }),
  (stateProps, dispatchProps, ownProps) => ({
    ...ownProps,
    onConfirm: () => dispatchProps._onConfirm(stateProps.myUsername),
    onDismiss: dispatchProps.onDismiss,
  })
)(Task)

const DeviceConnector = connect<TodoOwnProps, _, _, _, _>(
  () => ({}),
  dispatch => ({
    onConfirm: () => openURL(installLinkURL),
    onDismiss: onSkipTodo('device', dispatch),
  }),
  (s, d, o) => ({...o, ...s, ...d})
)(Task)

const FollowConnector = connect<TodoOwnProps, _, _, _, _>(
  () => ({}),
  dispatch => ({
    onConfirm: () => dispatch(navigateAppend(['search'], [Tabs.peopleTab])),
    onDismiss: onSkipTodo('follow', dispatch),
  }),
  (s, d, o) => ({...o, ...s, ...d})
)(Task)

const ChatConnector = connect<TodoOwnProps, _, _, _, _>(
  () => ({}),
  dispatch => ({
    onConfirm: () => dispatch(switchTo([Tabs.chatTab])),
    onDismiss: onSkipTodo('chat', dispatch),
  }),
  (s, d, o) => ({...o, ...s, ...d})
)(Task)

const PaperKeyConnector = connect<TodoOwnProps, _, _, _, _>(
  () => ({}),
  dispatch => ({
    onConfirm: () => {
      if (!isMobile) {
        dispatch(switchTo([Tabs.devicesTab]))
      } else {
        dispatch(navigateTo([SettingsTabs.devicesTab], [Tabs.settingsTab]))
        dispatch(switchTo([Tabs.settingsTab]))
      }
    },
    onDismiss: () => {},
  }),
  (s, d, o) => ({...o, ...s, ...d})
)(Task)

const TeamConnector = connect<TodoOwnProps, _, _, _, _>(
  () => ({}),
  dispatch => ({
    onConfirm: () => {
      dispatch(navigateAppend(['showNewTeamDialog'], [Tabs.teamsTab]))
      dispatch(switchTo([Tabs.teamsTab]))
    },
    onDismiss: onSkipTodo('team', dispatch),
  }),
  (s, d, o) => ({...o, ...s, ...d})
)(Task)

const FolderConnector = connect<TodoOwnProps, _, _, _, _>(
  () => ({}),
  dispatch => ({
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
  }),
  (s, d, o) => ({...o, ...s, ...d})
)(Task)

const GitRepoConnector = connect<TodoOwnProps, _, _, _, _>(
  () => ({}),
  dispatch => ({
    onConfirm: () => {
      dispatch(navigateTo([{props: {isTeam: false}, selected: 'newRepo'}], [Tabs.gitTab]))
      dispatch(switchTo([Tabs.gitTab]))
    },
    onDismiss: onSkipTodo('gitRepo', dispatch),
  }),
  (s, d, o) => ({...o, ...s, ...d})
)(Task)

const TeamShowcaseConnector = connect<TodoOwnProps, _, _, _, _>(
  () => ({}),
  dispatch => ({
    onConfirm: () => {
      // TODO find a team that the current user is an admin of and nav there?
      dispatch(navigateTo([], [Tabs.teamsTab]))
      dispatch(switchTo([Tabs.teamsTab]))
    },
    onDismiss: onSkipTodo('teamShowcase', dispatch),
  }),
  (s, d, o) => ({...o, ...s, ...d})
)(Task)

const TaskChooser = (props: TodoOwnProps) => {
  switch (props.todoType) {
    case todoTypes.avatarTeam:
      return <AvatarTeamConnector {...props} />
    case todoTypes.avatarUser:
      return <AvatarUserConnector {...props} />
    case todoTypes.bio:
      return <BioConnector {...props} />
    case todoTypes.proof:
      return <ProofConnector {...props} />
    case todoTypes.device:
      return <DeviceConnector {...props} />
    case todoTypes.follow:
      return <FollowConnector {...props} />
    case todoTypes.chat:
      return <ChatConnector {...props} />
    case todoTypes.paperkey:
      return <PaperKeyConnector {...props} />
    case todoTypes.team:
      return <TeamConnector {...props} />
    case todoTypes.folder:
      return <FolderConnector {...props} />
    case todoTypes.gitRepo:
      return <GitRepoConnector {...props} />
    case todoTypes.teamShowcase:
      return <TeamShowcaseConnector {...props} />
  }
  return null
}

export default TaskChooser
