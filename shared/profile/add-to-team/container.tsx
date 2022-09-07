import * as Constants from '../../constants/teams'
import * as Container from '../../util/container'
import * as React from 'react'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as TeamsGen from '../../actions/teams-gen'
import * as WaitingConstants from '../../constants/waiting'
import AddToTeam, {type AddToTeamProps} from './index'
import type * as Types from '../../constants/types/teams'
import {memoize} from '../../util/memoize'
import {sendNotificationFooter} from '../../teams/role-picker'

type OwnProps = Container.RouteProps<'profileAddToTeam'>

const getOwnerDisabledReason = memoize((selected: Set<string>, teamNameToRole) => {
  return [...selected]
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
  onAddToTeams: (role: Types.TeamRoleType, teams: Array<string>) => void
  _teamNameToRole: Map<string, Types.MaybeTeamRoleType>
}

type SelectedTeamState = Set<string>

type State = {
  rolePickerOpen: boolean
  selectedRole: Types.TeamRoleType
  sendNotification: boolean
  selectedTeams: SelectedTeamState
}

export class AddToTeamStateWrapper extends React.Component<ExtraProps & AddToTeamProps, State> {
  static navigationOptions = AddToTeam.navigationOptions

  state = {
    rolePickerOpen: false,
    selectedRole: 'writer' as const,
    selectedTeams: new Set<string>(),
    sendNotification: true,
  }

  componentDidMount() {
    this.props.clearAddUserToTeamsResults()
    this.props.loadTeamList()
  }

  onSave = () => {
    this.props.onAddToTeams(this.state.selectedRole, [...this.state.selectedTeams])
  }

  toggleTeamSelected = (teamName: string, selected: boolean) => {
    this.setState(({selectedTeams, selectedRole}) => {
      const nextSelectedTeams = new Set(selectedTeams)
      if (selected) {
        nextSelectedTeams.add(teamName)
      } else {
        nextSelectedTeams.delete(teamName)
      }
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
        onConfirmRolePicker={role => {
          this.setState({rolePickerOpen: false, selectedRole: role})
        }}
        footerComponent={
          <>
            {sendNotificationFooter('Announce them in team chats', this.state.sendNotification, nextVal =>
              this.setState({sendNotification: nextVal})
            )}
          </>
        }
        isRolePickerOpen={this.state.rolePickerOpen}
        onCancelRolePicker={() => {
          this.setState({rolePickerOpen: false})
        }}
        selectedRole={this.state.selectedRole}
        onToggle={this.toggleTeamSelected}
        onSave={this.onSave}
        selectedTeams={this.state.selectedTeams}
      />
    )
  }
}

export default Container.connect(
  (state, ownProps: OwnProps) => ({
    _roles: state.teams.teamRoleMap.roles,
    _teams: state.teams.teamMeta,
    _them: ownProps.route.params?.username ?? '',
    addUserToTeamsResults: state.teams.addUserToTeamsResults,
    addUserToTeamsState: state.teams.addUserToTeamsState,
    teamProfileAddList: state.teams.teamProfileAddList,
    teamnames: Constants.getSortedTeamnames(state),
    waiting: WaitingConstants.anyWaiting(state, Constants.teamProfileAddListWaitingKey),
  }),
  (dispatch, ownProps: OwnProps) => ({
    _onAddToTeams: (role: Types.TeamRoleType, teams: Array<string>, user: string) => {
      dispatch(TeamsGen.createAddUserToTeams({role, teams, user}))
    },
    clearAddUserToTeamsResults: () => dispatch(TeamsGen.createClearAddUserToTeamsResults()),
    loadTeamList: () =>
      dispatch(TeamsGen.createGetTeamProfileAddList({username: ownProps.route.params?.username ?? ''})),
    onBack: () => {
      dispatch(RouteTreeGen.createNavigateUp())
      dispatch(TeamsGen.createSetTeamProfileAddList({teamlist: []}))
    },
  }),
  (stateProps, dispatchProps, _: OwnProps) => {
    const {teamProfileAddList, _them} = stateProps
    const title = `Add ${_them} to...`

    // TODO Y2K-1086 use team ID given in teamProfileAddList to avoid this mapping
    const _teamNameToRole = [...stateProps._teams.values()].reduce<Map<string, Types.MaybeTeamRoleType>>(
      (res, curr) => res.set(curr.teamname, stateProps._roles.get(curr.id)?.role || 'none'),
      new Map()
    )
    return {
      _teamNameToRole,
      addUserToTeamsResults: stateProps.addUserToTeamsResults,
      addUserToTeamsState: stateProps.addUserToTeamsState,
      clearAddUserToTeamsResults: dispatchProps.clearAddUserToTeamsResults,
      loadTeamList: dispatchProps.loadTeamList,
      onAddToTeams: (role: Types.TeamRoleType, teams: Array<string>) =>
        dispatchProps._onAddToTeams(role, teams, stateProps._them),
      onBack: dispatchProps.onBack,
      teamProfileAddList: teamProfileAddList,
      them: _them,
      title,
      waiting: stateProps.waiting,
    }
  }
)(AddToTeamStateWrapper)
