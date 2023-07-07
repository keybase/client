import * as Constants from '../../constants/teams'
import * as Container from '../../util/container'
import * as React from 'react'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as TeamsGen from '../../actions/teams-gen'
import AddToTeam, {type AddToTeamProps} from './index'
import type * as Types from '../../constants/types/teams'
import {memoize} from '../../util/memoize'
import {sendNotificationFooter} from '../../teams/role-picker'

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

type OwnProps = {username: string}
export default (ownProps: OwnProps) => {
  const _them = ownProps.username
  const _roles = Container.useSelector(state => state.teams.teamRoleMap.roles)
  const _teams = Container.useSelector(state => state.teams.teamMeta)
  const addUserToTeamsResults = Constants.useState(s => s.addUserToTeamsResults)
  const addUserToTeamsState = Constants.useState(s => s.addUserToTeamsState)
  const clearAddUserToTeamsResults = Constants.useState(s => s.dispatch.clearAddUserToTeamsResults)
  const addUserToTeams = Constants.useState(s => s.dispatch.addUserToTeams)
  const teamProfileAddList = Container.useSelector(state => state.teams.teamProfileAddList)
  const waiting = Container.useAnyWaiting(Constants.teamProfileAddListWaitingKey)
  const dispatch = Container.useDispatch()
  const _onAddToTeams = addUserToTeams
  const loadTeamList = () => {
    dispatch(TeamsGen.createGetTeamProfileAddList({username: _them}))
  }
  const onBack = () => {
    dispatch(RouteTreeGen.createNavigateUp())
    dispatch(TeamsGen.createSetTeamProfileAddList({teamlist: []}))
  }

  const title = `Add ${_them} to...`

  // TODO Y2K-1086 use team ID given in teamProfileAddList to avoid this mapping
  const _teamNameToRole = [..._teams.values()].reduce<Map<string, Types.MaybeTeamRoleType>>(
    (res, curr) => res.set(curr.teamname, _roles.get(curr.id)?.role || 'none'),
    new Map()
  )
  const props = {
    _teamNameToRole,
    addUserToTeamsResults,
    addUserToTeamsState,
    clearAddUserToTeamsResults,
    loadTeamList,
    onAddToTeams: (role: Types.TeamRoleType, teams: Array<string>) => _onAddToTeams(role, teams, _them),
    onBack,
    teamProfileAddList,
    them: _them,
    title,
    waiting,
  }
  return <AddToTeamStateWrapper {...props} />
}
