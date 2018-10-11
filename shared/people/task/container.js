// @flow
import {Task} from '.'
import * as PeopleGen from '../../actions/people-gen'
import * as Types from '../../constants/types/people'
import * as Tabs from '../../constants/tabs'
import * as SettingsTabs from '../../constants/settings'
import {todoTypes} from '../../constants/people'
import {connect, branch, compose, renderNothing} from '../../util/container'
import {createGetMyProfile} from '../../actions/tracker-gen'
import {navigateAppend, switchTo, navigateTo} from '../../actions/route-tree'
import {createShowUserProfile} from '../../actions/profile-gen'
import openURL from '../../util/open-url'
import {isMobile} from '../../constants/platform'

const installLinkURL = 'https://keybase.io/download'

const onSkipTodo = (type: Types.TodoType, dispatch) => () => dispatch(PeopleGen.createSkipTodo({type}))

const mapStateToProps = state => ({myUsername: state.config.username || ''})

// ----- AVATAR TEAM ----- //
const avatarTeamConnector = connect(
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
)

// ----- AVATAR USER ----- //
const avatarUserConnector = connect(
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
    onConfirm: () => dispatchProps.onConfirm(),
    onDismiss: dispatchProps.onDismiss,
  })
)

// ----- BIO ----- //
const bioConnector = connect(
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
)

// ----- PROOF ----- //
const proofConnector = connect(
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
)

// ----- DEVICE ----- //
const deviceConnector = connect(
  () => ({}),
  dispatch => ({
    onConfirm: () => openURL(installLinkURL),
    onDismiss: onSkipTodo('device', dispatch),
  }),
  (s, d, o) => ({...o, ...s, ...d})
)

// ----- FOLLOW ----- //
const followConnector = connect(
  () => ({}),
  dispatch => ({
    onConfirm: () => dispatch(navigateAppend(['search'], [Tabs.peopleTab])),
    onDismiss: onSkipTodo('follow', dispatch),
  }),
  (s, d, o) => ({...o, ...s, ...d})
)

// ----- CHAT ----- //
const chatConnector = connect(
  () => ({}),
  dispatch => ({
    onConfirm: () => dispatch(switchTo([Tabs.chatTab])),
    onDismiss: onSkipTodo('chat', dispatch),
  }),
  (s, d, o) => ({...o, ...s, ...d})
)

// ----- PAPERKEY ----- //
const paperKeyConnector = connect(
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
)

// ----- TEAM ----- //
const teamConnector = connect(
  () => ({}),
  dispatch => ({
    onConfirm: () => {
      dispatch(navigateAppend(['showNewTeamDialog'], [Tabs.teamsTab]))
      dispatch(switchTo([Tabs.teamsTab]))
    },
    onDismiss: onSkipTodo('team', dispatch),
  }),
  (s, d, o) => ({...o, ...s, ...d})
)

// ----- FOLDER ----- //
const folderConnector = connect(
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
)

// ----- GITREPO ----- //
const gitRepoConnector = connect(
  () => ({}),
  dispatch => ({
    onConfirm: () => {
      dispatch(navigateTo([{selected: 'newRepo', props: {isTeam: false}}], [Tabs.gitTab]))
      dispatch(switchTo([Tabs.gitTab]))
    },
    onDismiss: onSkipTodo('gitRepo', dispatch),
  }),
  (s, d, o) => ({...o, ...s, ...d})
)

// ----- TEAMSHOWCASE ----- //
const teamShowcaseConnector = connect(
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
)

export default compose(
  // TODO remove all this branch and just make a component
  branch(props => props.todoType === todoTypes.avatarTeam, avatarTeamConnector),
  branch(props => props.todoType === todoTypes.avatarUser, avatarUserConnector),
  branch(props => props.todoType === todoTypes.bio, bioConnector),
  branch(props => props.todoType === todoTypes.proof, proofConnector),
  branch(props => props.todoType === todoTypes.device, deviceConnector),
  branch(props => props.todoType === todoTypes.follow, followConnector),
  branch(props => props.todoType === todoTypes.chat, chatConnector),
  branch(props => props.todoType === todoTypes.paperkey, paperKeyConnector),
  branch(props => props.todoType === todoTypes.team, teamConnector),
  branch(props => props.todoType === todoTypes.folder, folderConnector),
  branch(props => props.todoType === todoTypes.gitRepo, gitRepoConnector),
  branch(props => props.todoType === todoTypes.teamShowcase, teamShowcaseConnector),
  branch(props => !props.onConfirm, renderNothing)
)(Task)
