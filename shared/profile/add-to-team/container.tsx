import * as I from 'immutable'
import * as React from 'react'
import AddToTeam, {AddToTeamProps} from './index'
import * as Container from '../../util/container'
import {memoize} from '../../util/memoize'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as TeamsGen from '../../actions/teams-gen'
import * as Constants from '../../constants/teams'
import * as WaitingConstants from '../../constants/waiting'
import {HeaderOnMobile} from '../../common-adapters'
import {sendNotificationFooter} from '../../teams/role-picker'
import {TeamRoleType, MaybeTeamRoleType, Teamname} from '../../constants/types/teams'

type OwnProps = Container.RouteProps<{username: string}>

const getOwnerDisabledReason = memoize((selected: I.Set<Teamname>, teamNameToRole) => {
  return selected
    .toSeq()
    .map(teamName => {
      if (Constants.isSubteam(teamName)) {
        return `${teamName} is a subteam which cannot have owners.`
      } else if (teamNameToRole.get(teamName) !== 'owner') {
        return `You are not an owner of ${teamName}.`
      }
      return ''
    })
    .find(v => !!v)
})

type ExtraProps = {
  clearAddUserToTeamsResults: () => void
  loadTeamList: () => void
  onAddToTeams: (role: TeamRoleType, teams: Array<string>) => void
  _teamNameToRole: I.Map<Teamname, MaybeTeamRoleType>
}

type TeamName = string
type SelectedTeamState = I.Set<TeamName>

type State = {
  rolePickerOpen: boolean
  selectedRole: TeamRoleType
  sendNotification: boolean
  selectedTeams: SelectedTeamState
}

class AddToTeamStateWrapper extends React.Component<{} & ExtraProps & AddToTeamProps, State> {
  state = {
    rolePickerOpen: false,
    selectedRole: 'writer' as 'writer',
    selectedTeams: I.Set(),
    sendNotification: true,
  }

  componentDidMount() {
    this.props.clearAddUserToTeamsResults()
    this.props.loadTeamList()
  }

  onSave = () => {
    this.props.onAddToTeams(this.state.selectedRole, this.state.selectedTeams.toArray())
  }

  toggleTeamSelected = (teamName: string, selected: boolean) => {
    this.setState(({selectedTeams, selectedRole}) => {
      const nextSelectedTeams = selected ? selectedTeams.add(teamName) : selectedTeams.remove(teamName)
      const canNotBeOwner = !!getOwnerDisabledReason(nextSelectedTeams, this.props._teamNameToRole)

      return {
        // If you selected them to be an owner, but they cannot be an owner,
        // then fallback to admin
        selectedRole: selectedRole === 'owner' && canNotBeOwner ? 'admin' : selectedRole,
        selectedTeams: nextSelectedTeams,
      }
    })
  }

  render() {
    const {_teamNameToRole, clearAddUserToTeamsResults, onAddToTeams, ...rest} = this.props
    const ownerDisabledReason = getOwnerDisabledReason(this.state.selectedTeams, _teamNameToRole)
    return (
      <AddToTeam
        {...rest}
        disabledReasonsForRolePicker={ownerDisabledReason ? {owner: ownerDisabledReason} : {}}
        onOpenRolePicker={() => this.setState({rolePickerOpen: true})}
        onConfirmRolePicker={() => {
          this.setState({rolePickerOpen: false})
        }}
        footerComponent={() => (
          <>
            {sendNotificationFooter('Announce them in team chats', this.state.sendNotification, nextVal =>
              this.setState({sendNotification: nextVal})
            )}
          </>
        )}
        isRolePickerOpen={this.state.rolePickerOpen}
        onCancelRolePicker={() => {
          this.setState({rolePickerOpen: false})
        }}
        selectedRole={this.state.selectedRole}
        onToggle={this.toggleTeamSelected}
        onSelectRole={selectedRole => this.setState({selectedRole})}
        onSave={this.onSave}
        selectedTeams={this.state.selectedTeams}
      />
    )
  }
}

export default Container.connect(
  (state, ownProps: OwnProps) => ({
    _teamNameToRole: state.teams.teamNameToRole,
    _them: Container.getRouteProps(ownProps, 'username', ''),
    addUserToTeamsResults: state.teams.addUserToTeamsResults,
    addUserToTeamsState: state.teams.addUserToTeamsState,
    teamProfileAddList: state.teams.get('teamProfileAddList'),
    teamnames: Constants.getSortedTeamnames(state),
    waiting: WaitingConstants.anyWaiting(state, Constants.teamProfileAddListWaitingKey),
  }),
  (dispatch, ownProps: OwnProps) => ({
    _onAddToTeams: (role: TeamRoleType, teams: Array<string>, user: string) => {
      dispatch(TeamsGen.createAddUserToTeams({role, teams, user}))
    },
    clearAddUserToTeamsResults: () => dispatch(TeamsGen.createClearAddUserToTeamsResults()),
    loadTeamList: () =>
      dispatch(
        TeamsGen.createGetTeamProfileAddList({username: Container.getRouteProps(ownProps, 'username', '')})
      ),
    onBack: () => {
      dispatch(RouteTreeGen.createNavigateUp())
      dispatch(TeamsGen.createSetTeamProfileAddList({teamlist: I.List([])}))
    },
  }),
  (stateProps, dispatchProps, _: OwnProps) => {
    const {teamProfileAddList, _them} = stateProps
    const title = `Add ${_them} to...`

    return {
      _teamNameToRole: stateProps._teamNameToRole,
      addUserToTeamsResults: stateProps.addUserToTeamsResults,
      addUserToTeamsState: stateProps.addUserToTeamsState,
      clearAddUserToTeamsResults: dispatchProps.clearAddUserToTeamsResults,
      loadTeamList: dispatchProps.loadTeamList,
      onAddToTeams: (role: TeamRoleType, teams: Array<string>) =>
        dispatchProps._onAddToTeams(role, teams, stateProps._them),
      onBack: dispatchProps.onBack,
      teamProfileAddList: teamProfileAddList.toArray(),
      them: _them,
      title,
      waiting: stateProps.waiting,
    }
  }
)(HeaderOnMobile(AddToTeamStateWrapper))
