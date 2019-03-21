// @flow
import * as Constants from '../../../constants/teams'
import * as FsConstants from '../../../constants/fs'
import * as FsTypes from '../../../constants/types/fs'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as SearchGen from '../../../actions/search-gen'
import {
  HeaderRightActions as _HeaderRightActions,
  HeaderTitle as _HeaderTitle,
  SubHeader as _SubHeader,
} from '.'
import * as Container from '../../../util/container'
import {anyWaiting} from '../../../constants/waiting'

type OwnProps = {teamname: string}

const mapStateToProps = (state, {teamname}) => {
  const yourOperations = Constants.getCanPerform(state, teamname)
  return {
    canAddPeople: yourOperations.manageMembers,
    canChat: !yourOperations.joinTeam,
    canViewFolder: !yourOperations.joinTeam,
    loading: anyWaiting(state, Constants.teamWaitingKey(teamname)),
  }
}

const mapDispatchToProps = (dispatch, {teamname}) => ({
  onChat: () => dispatch(Chat2Gen.createPreviewConversation({reason: 'teamHeader', teamname})),
  onOpenFolder: () =>
    dispatch(FsConstants.makeActionForOpenPathInFilesTab(FsTypes.stringToPath(`/keybase/team/${teamname}`))),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  canAddPeople: stateProps.canAddPeople,
  canChat: stateProps.canChat,
  canViewFolder: stateProps.canViewFolder,
  loading: stateProps.loading,
  onChat: dispatchProps.onChat,
  onOpenFolder: dispatchProps.onOpenFolder,
  teamname: ownProps.teamname,
})

export const HeaderRightActions = Container.namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'TeamHeaderRightActions'
)(_HeaderRightActions)

const mapStateToPropsTitle = (state, {teamname}) => {
  const role = Constants.getRole(state, teamname)
  const description = Constants.getTeamPublicitySettings(state, teamname).description
  const members = Constants.getTeamMemberCount(state, teamname)
  return {
    _canEditDescription: Constants.getCanPerform(state, teamname).editTeamDescription,
    description,
    members,
    role,
    teamname,
  }
}

const mapDispatchToPropsTitle = (dispatch, {teamname}) => ({
  onEditDescription: () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'editTeamDescription'}]})
    ),
})
const mergePropsTitle = (stateProps, dispatchProps) => ({
  description: stateProps.description,
  members: stateProps.members,
  onEditDescription: stateProps._canEditDescription ? dispatchProps.onEditDescription : null,
  role: stateProps.role,
  teamname: stateProps.teamname,
})

export const HeaderTitle = Container.namedConnect<OwnProps, _, _, _, _>(
  mapStateToPropsTitle,
  mapDispatchToPropsTitle,
  mergePropsTitle,
  'TeamHeaderTitle'
)(_HeaderTitle)

const mapStateToPropsSub = (state, {teamname}) => ({
  _canAddSelf: Constants.getCanPerform(state, teamname).joinTeam,
  _you: state.config.username,
})

const mapDispatchToPropsSub = dispatch => ({
  onAddSelf: (you: string, teamname: string) => {
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'addPeople'}]}))
    dispatch(SearchGen.createAddResultsToUserInput({searchKey: 'addToTeamSearch', searchResults: [you]}))
  },
})

const mergePropsSub = (stateProps, dispatchProps, {teamname}) => ({
  onAddSelf: stateProps._canAddSelf ? () => dispatchProps.onAddSelf(stateProps._you, teamname) : null,
})

export const SubHeader = Container.namedConnect<OwnProps, _, _, _, _>(
  mapStateToPropsSub,
  mapDispatchToPropsSub,
  mergePropsSub,
  'TeamSubHeader'
)(_SubHeader)
