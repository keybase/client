import * as React from 'react'
import {Task} from '.'
import * as PeopleGen from '../../actions/people-gen'
import * as Types from '../../constants/types/people'
import * as Tabs from '../../constants/tabs'
import * as SettingsTabs from '../../constants/settings'
import {IconType} from '../../common-adapters/icon.constants'
import {todoTypes} from '../../constants/people'
import {connect, isMobile} from '../../util/container'
import * as Tracker2Gen from '../../actions/tracker2-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as ProfileGen from '../../actions/profile-gen'
import openURL from '../../util/open-url'

type TodoOwnProps = {
  badged: boolean
  confirmLabel: string
  dismissable: boolean
  icon: IconType
  instructions: string
  todoType: Types.TodoType
}

const installLinkURL = 'https://keybase.io/download'
const onSkipTodo = (type: Types.TodoType, dispatch) => () => dispatch(PeopleGen.createSkipTodo({type}))
const mapStateToProps = state => ({myUsername: state.config.username || ''})

const AvatarTeamConnector = connect(
  mapStateToProps,
  dispatch => ({
    onConfirm: () => dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.teamsTab})),
    onDismiss: () => {},
  }),
  (_, dispatchProps, ownProps: TodoOwnProps) => ({
    ...ownProps,
    onConfirm: () => dispatchProps.onConfirm(),
    onDismiss: dispatchProps.onDismiss,
  })
)(Task)

const AvatarUserConnector = connect(
  mapStateToProps,
  dispatch => ({
    _onConfirm: username => dispatch(ProfileGen.createEditAvatar()),
    onDismiss: () => {},
  }),
  (stateProps, dispatchProps, ownProps: TodoOwnProps) => ({
    ...ownProps,
    onConfirm: () => dispatchProps._onConfirm(stateProps.myUsername),
    onDismiss: dispatchProps.onDismiss,
  })
)(Task)

const BioConnector = connect(
  mapStateToProps,
  dispatch => ({
    _onConfirm: (username: string) => {
      // make sure we have tracker state & profile is up to date
      dispatch(Tracker2Gen.createShowUser({asTracker: false, username}))
    },
    onDismiss: () => {},
  }),
  (stateProps, dispatchProps, ownProps: TodoOwnProps) => ({
    ...ownProps,
    onConfirm: () => dispatchProps._onConfirm(stateProps.myUsername),
    onDismiss: dispatchProps.onDismiss,
  })
)(Task)

const ProofConnector = connect(
  mapStateToProps,
  dispatch => ({
    _onConfirm: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
    onDismiss: onSkipTodo('proof', dispatch),
  }),
  (stateProps, dispatchProps, ownProps: TodoOwnProps) => ({
    ...ownProps,
    onConfirm: () => dispatchProps._onConfirm(stateProps.myUsername),
    onDismiss: dispatchProps.onDismiss,
  })
)(Task)

const DeviceConnector = connect(
  () => ({}),
  dispatch => ({
    onConfirm: () => openURL(installLinkURL),
    onDismiss: onSkipTodo('device', dispatch),
  }),
  (s, d, o: TodoOwnProps) => ({...o, ...s, ...d})
)(Task)

const FollowConnector = connect(
  () => ({}),
  dispatch => ({
    onConfirm: () =>
      dispatch(RouteTreeGen.createNavigateAppend({parentPath: [Tabs.peopleTab], path: ['profileSearch']})),
    onDismiss: onSkipTodo('follow', dispatch),
  }),
  (s, d, o: TodoOwnProps) => ({...o, ...s, ...d, showSearchBar: true})
)(Task)

const ChatConnector = connect(
  () => ({}),
  dispatch => ({
    onConfirm: () => dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.chatTab})),
    onDismiss: onSkipTodo('chat', dispatch),
  }),
  (s, d, o: TodoOwnProps) => ({...o, ...s, ...d})
)(Task)

const PaperKeyConnector = connect(
  () => ({}),
  dispatch => ({
    onConfirm: () =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {highlight: ['paper key']}, selected: 'deviceAdd'}],
        })
      ),
    onDismiss: () => {},
  }),
  (s, d, o: TodoOwnProps) => ({...o, ...s, ...d})
)(Task)

const TeamConnector = connect(
  () => ({}),
  dispatch => ({
    onConfirm: () => {
      dispatch(RouteTreeGen.createNavigateAppend({parentPath: [Tabs.teamsTab], path: ['teamNewTeamDialog']}))
      dispatch(RouteTreeGen.createSwitchTo({path: [Tabs.teamsTab]}))
    },
    onDismiss: onSkipTodo('team', dispatch),
  }),
  (s, d, o: TodoOwnProps) => ({...o, ...s, ...d})
)(Task)

const FolderConnector = connect(
  () => ({}),
  dispatch => ({
    onConfirm: () => dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.fsTab})),
    onDismiss: onSkipTodo('folder', dispatch),
  }),
  (s, d, o: TodoOwnProps) => ({...o, ...s, ...d})
)(Task)

const GitRepoConnector = connect(
  () => ({}),
  dispatch => ({
    onConfirm: () => {
      if (isMobile) {
        dispatch(RouteTreeGen.createNavigateAppend({path: [SettingsTabs.gitTab]}))
      } else {
        dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.gitTab}))
      }
      dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {isTeam: false}, selected: 'gitNewRepo'}]}))
    },
    onDismiss: onSkipTodo('gitRepo', dispatch),
  }),
  (s, d, o: TodoOwnProps) => ({...o, ...s, ...d})
)(Task)

const TeamShowcaseConnector = connect(
  () => ({}),
  dispatch => ({
    onConfirm: () => dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.teamsTab})),
    onDismiss: onSkipTodo('teamShowcase', dispatch),
  }),
  (s, d, o: TodoOwnProps) => ({...o, ...s, ...d})
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
