// @flow
import {Task} from '.'
import * as PeopleGen from '../../actions/people-gen'
import * as Types from '../../constants/types/people'
import * as Tabs from '../../constants/tabs'
import * as SettingsTabs from '../../constants/settings'
import {connect} from 'react-redux'
import {branch, compose} from 'recompose'
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

// ----- BIO ----- //
const mapDispatchToPropsBio = (dispatch: Dispatch) => ({
  _onConfirm: (username: string) => {
    // make sure we have tracker state & profile is up to date
    dispatch(createGetMyProfile({}))
    dispatch(navigateAppend(['editProfile'], [Tabs.peopleTab]))
  },
  onDismiss: () => {},
})
const mergePropsBio = (stateProps, dispatchProps, ownProps) => ({
  ...ownProps,
  onConfirm: () => dispatchProps._onConfirm(stateProps.myUsername),
  onDismiss: dispatchProps.onDismiss,
})
const bioConnector = connect(mapStateToProps, mapDispatchToPropsBio, mergePropsBio)

// ----- PROOF ----- //
const mapDispatchToPropsProof = (dispatch: Dispatch) => ({
  _onConfirm: (username: string) => dispatch(createShowUserProfile({username})),
  onDismiss: onSkipTodo('proof', dispatch),
})
const mergePropsProof = mergePropsBio
const proofConnector = connect(mapStateToProps, mapDispatchToPropsProof, mergePropsProof)

// ----- DEVICE ----- //
const mapDispatchToPropsDevice = (dispatch: Dispatch) => ({
  onConfirm: () => openURL(installLinkURL),
  onDismiss: onSkipTodo('device', dispatch),
})
const deviceConnector = connect(() => ({}), mapDispatchToPropsDevice)

// ----- FOLLOW ----- //
const mapDispatchToPropsFollow = (dispatch: Dispatch) => ({
  onConfirm: () => dispatch(navigateAppend(['search'], [Tabs.peopleTab])),
  onDismiss: onSkipTodo('follow', dispatch),
})
const followConnector = connect(() => ({}), mapDispatchToPropsFollow)

// ----- CHAT ----- //
const mapDispatchToPropsChat = (dispatch: Dispatch) => ({
  onConfirm: () => dispatch(switchTo([Tabs.chatTab])),
  onDismiss: onSkipTodo('chat', dispatch),
})
const chatConnector = connect(() => ({}), mapDispatchToPropsChat)

// ----- PAPERKEY ----- //
const mapDispatchToPropsPaperKey = (dispatch: Dispatch) => ({
  onConfirm: () => {
    if (!isMobile) {
      dispatch(switchTo([Tabs.devicesTab]))
    } else {
      dispatch(navigateTo([SettingsTabs.devicesTab], [Tabs.settingsTab]))
      dispatch(switchTo([Tabs.settingsTab]))
    }
  },
  onDismiss: () => {},
})
const paperKeyConnector = connect(() => ({}), mapDispatchToPropsPaperKey)

// ----- TEAM ----- //
const mapDispatchToPropsTeam = (dispatch: Dispatch) => ({
  onConfirm: () => {
    dispatch(navigateAppend(['showNewTeamDialog'], [Tabs.teamsTab]))
    dispatch(switchTo([Tabs.teamsTab]))
  },
  onDismiss: onSkipTodo('team', dispatch),
})
const teamConnector = connect(() => ({}), mapDispatchToPropsTeam)

// ----- FOLDER ----- //
const mapDispatchToPropsFolder = (dispatch: Dispatch) => ({
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
})
const folderConnector = connect(() => ({}), mapDispatchToPropsFolder)

// ----- GITREPO ----- //
const mapDispatchToPropsGitRepo = (dispatch: Dispatch) => ({
  onConfirm: () => {
    dispatch(navigateTo([{selected: 'newRepo', props: {isTeam: false}}], [Tabs.gitTab]))
    dispatch(switchTo([Tabs.gitTab]))
  },
  onDismiss: onSkipTodo('gitRepo', dispatch),
})
const gitRepoConnector = connect(() => ({}), mapDispatchToPropsGitRepo)

// ----- TEAMSHOWCASE ----- //
const mapDispatchToPropsTeamShowcase = (dispatch: Dispatch) => ({
  onConfirm: () => {
    // TODO find a team that the current user is an admin of and nav there?
    dispatch(navigateTo([], [Tabs.teamsTab]))
    dispatch(switchTo([Tabs.teamsTab]))
  },
  onDismiss: onSkipTodo('teamShowcase', dispatch),
})
const teamShowcaseConnector = connect(() => ({}), mapDispatchToPropsTeamShowcase)

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
  branch(props => props.todoType === 'teamshowcase', teamShowcaseConnector)
)(Task)
