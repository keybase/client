import * as C from '@/constants'
import * as React from 'react'
import AddToTeam, {type AddToTeamProps} from '.'
import type * as T from '@/constants/types'
import {sendNotificationFooter} from '@/teams/role-picker'

const getOwnerDisabledReason = (
  selected: Set<string>,
  teamNameToRole: Map<string, T.Teams.MaybeTeamRoleType>
) => {
  return [...selected]
    .map(teamName => {
      if (C.Teams.isSubteam(teamName)) {
        return `${teamName} is a subteam which cannot have owners.`
      } else if (teamNameToRole.get(teamName) !== 'owner') {
        return `You are not an owner of ${teamName}.`
      }
      return ''
    })
    .find(v => !!v)
}

type ExtraProps = {
  clearAddUserToTeamsResults: () => void
  loadTeamList: () => void
  onAddToTeams: (role: T.Teams.TeamRoleType, teams: Array<string>) => void
  _teamNameToRole: Map<string, T.Teams.MaybeTeamRoleType>
}

const AddToTeamStateWrapper = (p: ExtraProps & AddToTeamProps) => {
  const {_teamNameToRole} = p

  const [selectedTeams, setSelectedTeams] = React.useState(new Set<string>())

  const [rolePickerOpen, setRolePickerOpen] = React.useState(false)
  const [selectedRole, setSelectedRole] = React.useState<T.Teams.TeamRoleType>('writer')
  const [sendNotification, setSendNotification] = React.useState(true)

  const ownerDisabledReason = React.useMemo(
    () => getOwnerDisabledReason(selectedTeams, _teamNameToRole),
    [selectedTeams, _teamNameToRole]
  )
  const props = {
    ...p,
    ownerDisabledReason,
    rolePickerOpen,
    selectedRole,
    selectedTeams,
    sendNotification,
    setRolePickerOpen,
    setSelectedRole,
    setSelectedTeams,
    setSendNotification,
  }

  return <AddToTeamStateWrapper2 {...props} />
}

class AddToTeamStateWrapper2 extends React.Component<
  ExtraProps &
    AddToTeamProps & {
      ownerDisabledReason: string | undefined
      selectedTeams: Set<string>
      setSelectedTeams: (s: Set<string>) => void
      setRolePickerOpen: React.Dispatch<React.SetStateAction<boolean>>
      setSelectedRole: React.Dispatch<React.SetStateAction<T.Teams.TeamRoleType>>
      setSendNotification: React.Dispatch<React.SetStateAction<boolean>>
      rolePickerOpen: boolean
      selectedRole: T.Teams.TeamRoleType
      sendNotification: boolean
    }
> {
  componentDidMount() {
    this.props.clearAddUserToTeamsResults()
    this.props.loadTeamList()
  }

  onSave = () => {
    this.props.onAddToTeams(this.props.selectedRole, [...this.props.selectedTeams])
  }

  toggleTeamSelected = (teamName: string, selected: boolean) => {
    const nextSelectedTeams = new Set(this.props.selectedTeams)
    if (selected) {
      nextSelectedTeams.add(teamName)
    } else {
      nextSelectedTeams.delete(teamName)
    }
    const canNotBeOwner = !!getOwnerDisabledReason(nextSelectedTeams, this.props._teamNameToRole)

    // If you selected them to be an owner, but they cannot be an owner,
    // then fallback to admin
    this.props.setSelectedRole(
      this.props.selectedRole === 'owner' && canNotBeOwner ? 'admin' : this.props.selectedRole
    )
    this.props.setSelectedTeams(nextSelectedTeams)
  }

  render() {
    const {ownerDisabledReason, _teamNameToRole, clearAddUserToTeamsResults, onAddToTeams, ...rest} =
      this.props
    return (
      <AddToTeam
        {...rest}
        disabledReasonsForRolePicker={ownerDisabledReason ? {owner: ownerDisabledReason} : {}}
        onOpenRolePicker={() => this.props.setRolePickerOpen(true)}
        onConfirmRolePicker={role => {
          this.props.setRolePickerOpen(false)
          this.props.setSelectedRole(role)
        }}
        footerComponent={
          <>
            {sendNotificationFooter('Announce them in team chats', this.props.sendNotification, nextVal =>
              this.props.setSendNotification(nextVal)
            )}
          </>
        }
        isRolePickerOpen={this.props.rolePickerOpen}
        onCancelRolePicker={() => {
          this.props.setRolePickerOpen(false)
        }}
        selectedRole={this.props.selectedRole}
        onToggle={this.toggleTeamSelected}
        onSave={this.onSave}
        selectedTeams={this.props.selectedTeams}
      />
    )
  }
}

type OwnProps = {username: string}
const Container = (ownProps: OwnProps) => {
  const _them = ownProps.username
  const _roles = C.useTeamsState(s => s.teamRoleMap.roles)
  const _teams = C.useTeamsState(s => s.teamMeta)
  const addUserToTeamsResults = C.useTeamsState(s => s.addUserToTeamsResults)
  const addUserToTeamsState = C.useTeamsState(s => s.addUserToTeamsState)
  const clearAddUserToTeamsResults = C.useTeamsState(s => s.dispatch.clearAddUserToTeamsResults)
  const addUserToTeams = C.useTeamsState(s => s.dispatch.addUserToTeams)
  const teamProfileAddList = C.useTeamsState(s => s.teamProfileAddList)
  const waiting = C.Waiting.useAnyWaiting(C.Teams.teamProfileAddListWaitingKey)
  const _onAddToTeams = addUserToTeams
  const getTeamProfileAddList = C.useTeamsState(s => s.dispatch.getTeamProfileAddList)
  const resetTeamProfileAddList = C.useTeamsState(s => s.dispatch.resetTeamProfileAddList)
  const loadTeamList = () => {
    getTeamProfileAddList(_them)
  }
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => {
    navigateUp()
    resetTeamProfileAddList()
  }

  const title = `Add ${_them} to...`

  // TODO Y2K-1086 use team ID given in teamProfileAddList to avoid this mapping
  const _teamNameToRole = [..._teams.values()].reduce<Map<string, T.Teams.MaybeTeamRoleType>>(
    (res, curr) => res.set(curr.teamname, _roles.get(curr.id)?.role || 'none'),
    new Map()
  )
  const props = {
    _teamNameToRole,
    addUserToTeamsResults,
    addUserToTeamsState,
    clearAddUserToTeamsResults,
    loadTeamList,
    onAddToTeams: (role: T.Teams.TeamRoleType, teams: Array<string>) => _onAddToTeams(role, teams, _them),
    onBack,
    teamProfileAddList,
    them: _them,
    title,
    waiting,
  }
  return <AddToTeamStateWrapper {...props} />
}

export default Container
