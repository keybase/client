// @flow
import {Task} from '.'
import * as PeopleGen from '../../actions/people-gen'
import * as Types from '../../constants/types/people'
import * as Tabs from '../../constants/tabs'
import * as SettingsTabs from '../../constants/settings'
import {connect, branch, compose, renderNothing} from '../../util/container'
import {type TypedState} from '../../constants/reducer'
import {createGetMyProfile} from '../../actions/tracker-gen'
import {navigateAppend, switchTo, navigateTo} from '../../actions/route-tree'
import {createShowUserProfile} from '../../actions/profile-gen'
import openURL from '../../util/open-url'
import {isMobile} from '../../constants/platform'

const installLinkURL = 'https://keybase.io/download'

const onSkipTodo = (type: Types.TodoType, dispatch: Dispatch) => () =>
  dispatch(PeopleGen.createSkipTodo({type}))

const mapStateToProps = (state: TypedState) => ({myUsername: state.config.username})

const makeConnector = (mapDispatchToProps, mapStateToProps?, mergeProps?) =>
  mergeProps
    ? connect(mapStateToProps || (() => ({})), mapDispatchToProps, mergeProps)
    : connect(mapStateToProps || (() => ({})), mapDispatchToProps)

// ----- BIO ----- //
const bioConnector = makeConnector(
  (dispatch: Dispatch) => ({
    _onConfirm: (username: string) => {
      // make sure we have tracker state & profile is up to date
      dispatch(createGetMyProfile({}))
      dispatch(navigateAppend(['editProfile'], [Tabs.peopleTab]))
    },
    onDismiss: () => {},
  }),
  mapStateToProps,
  (stateProps, dispatchProps, ownProps) => ({
    ...ownProps,
    onConfirm: () => dispatchProps._onConfirm(stateProps.myUsername),
    onDismiss: dispatchProps.onDismiss,
  })
)

// ----- PROOF ----- //
const proofConnector = makeConnector(
  (dispatch: Dispatch) => ({
    _onConfirm: (username: string) => dispatch(createShowUserProfile({username})),
    onDismiss: onSkipTodo('proof', dispatch),
  }),
  mapStateToProps,
  (stateProps, dispatchProps, ownProps) => ({
    ...ownProps,
    onConfirm: () => dispatchProps._onConfirm(stateProps.myUsername),
    onDismiss: dispatchProps.onDismiss,
  })
)

// ----- DEVICE ----- //
const deviceConnector = makeConnector((dispatch: Dispatch) => ({
  onConfirm: () => openURL(installLinkURL),
  onDismiss: onSkipTodo('device', dispatch),
}))

// ----- FOLLOW ----- //
const followConnector = makeConnector((dispatch: Dispatch) => ({
  onConfirm: () => dispatch(navigateAppend(['search'], [Tabs.peopleTab])),
  onDismiss: onSkipTodo('follow', dispatch),
}))

// ----- CHAT ----- //
const chatConnector = makeConnector((dispatch: Dispatch) => ({
  onConfirm: () => dispatch(switchTo([Tabs.chatTab])),
  onDismiss: onSkipTodo('chat', dispatch),
}))

// ----- PAPERKEY ----- //
const paperKeyConnector = makeConnector((dispatch: Dispatch) => ({
  onConfirm: () => {
    if (!isMobile) {
      dispatch(switchTo([Tabs.devicesTab]))
    } else {
      dispatch(navigateTo([SettingsTabs.devicesTab], [Tabs.settingsTab]))
      dispatch(switchTo([Tabs.settingsTab]))
    }
  },
  onDismiss: () => {},
}))

// ----- TEAM ----- //
const teamConnector = makeConnector((dispatch: Dispatch) => ({
  onConfirm: () => {
    dispatch(navigateAppend(['showNewTeamDialog'], [Tabs.teamsTab]))
    dispatch(switchTo([Tabs.teamsTab]))
  },
  onDismiss: onSkipTodo('team', dispatch),
}))

// ----- FOLDER ----- //
const folderConnector = makeConnector((dispatch: Dispatch) => ({
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
}))

// ----- GITREPO ----- //
const gitRepoConnector = makeConnector((dispatch: Dispatch) => ({
  onConfirm: () => {
    dispatch(navigateTo([{selected: 'newRepo', props: {isTeam: false}}], [Tabs.gitTab]))
    dispatch(switchTo([Tabs.gitTab]))
  },
  onDismiss: onSkipTodo('gitRepo', dispatch),
}))

// ----- TEAMSHOWCASE ----- //
const teamShowcaseConnector = makeConnector((dispatch: Dispatch) => ({
  onConfirm: () => {
    // TODO find a team that the current user is an admin of and nav there?
    dispatch(navigateTo([], [Tabs.teamsTab]))
    dispatch(switchTo([Tabs.teamsTab]))
  },
  onDismiss: onSkipTodo('teamShowcase', dispatch),
}))

export default compose(
  branch(props => props.todoType === 'bio', bioConnector),
  branch(props => props.todoType === 'proof', proofConnector),
  branch(props => props.todoType === 'device', deviceConnector),
  branch(props => props.todoType === 'follow', followConnector),
  branch(props => props.todoType === 'chat', chatConnector),
  branch(props => props.todoType === 'paperkey', paperKeyConnector),
  branch(props => props.todoType === 'team', teamConnector),
  branch(props => props.todoType === 'folder', folderConnector),
  branch(props => props.todoType === 'gitrepo', gitRepoConnector),
  branch(props => props.todoType === 'teamshowcase', teamShowcaseConnector),
  branch(props => !props.onConfirm, renderNothing)
)(Task)
