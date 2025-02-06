import * as C from '@/constants'
import * as React from 'react'
import AddToTeam from '.'
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

type OwnProps = {username: string}
const Container = (ownProps: OwnProps) => {
  const {username: them} = ownProps
  const roles = C.useTeamsState(s => s.teamRoleMap.roles)
  const teams = C.useTeamsState(s => s.teamMeta)
  const addUserToTeamsResults = C.useTeamsState(s => s.addUserToTeamsResults)
  const addUserToTeamsState = C.useTeamsState(s => s.addUserToTeamsState)
  const clearAddUserToTeamsResults = C.useTeamsState(s => s.dispatch.clearAddUserToTeamsResults)
  const addUserToTeams = C.useTeamsState(s => s.dispatch.addUserToTeams)
  const teamProfileAddList = C.useTeamsState(s => s.teamProfileAddList)
  const waiting = C.Waiting.useAnyWaiting(C.Teams.teamProfileAddListWaitingKey)
  const _onAddToTeams = addUserToTeams
  const getTeamProfileAddList = C.useTeamsState(s => s.dispatch.getTeamProfileAddList)
  const resetTeamProfileAddList = C.useTeamsState(s => s.dispatch.resetTeamProfileAddList)
  const loadTeamList = React.useCallback(() => {
    getTeamProfileAddList(them)
  }, [getTeamProfileAddList, them])
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => {
    navigateUp()
    resetTeamProfileAddList()
  }

  const title = `Add ${them} to...`

  // TODO Y2K-1086 use team ID given in teamProfileAddList to avoid this mapping
  const _teamNameToRole = [...teams.values()].reduce<Map<string, T.Teams.MaybeTeamRoleType>>(
    (res, curr) => res.set(curr.teamname, roles.get(curr.id)?.role || 'none'),
    new Map()
  )
  const onAddToTeams = (role: T.Teams.TeamRoleType, teams: Array<string>) => _onAddToTeams(role, teams, them)
  const [selectedTeams, setSelectedTeams] = React.useState(new Set<string>())
  const [rolePickerOpen, setRolePickerOpen] = React.useState(false)
  const [selectedRole, setSelectedRole] = React.useState<T.Teams.TeamRoleType>('writer')
  const [sendNotification, setSendNotification] = React.useState(true)

  const ownerDisabledReason = React.useMemo(
    () => getOwnerDisabledReason(selectedTeams, _teamNameToRole),
    [selectedTeams, _teamNameToRole]
  )

  React.useEffect(() => {
    clearAddUserToTeamsResults()
    loadTeamList()
  }, [clearAddUserToTeamsResults, loadTeamList])

  const onSave = () => {
    onAddToTeams(selectedRole, [...selectedTeams])
  }

  const toggleTeamSelected = (teamName: string, selected: boolean) => {
    const nextSelectedTeams = new Set(selectedTeams)
    if (selected) {
      nextSelectedTeams.add(teamName)
    } else {
      nextSelectedTeams.delete(teamName)
    }
    const canNotBeOwner = !!getOwnerDisabledReason(nextSelectedTeams, _teamNameToRole)

    // If you selected them to be an owner, but they cannot be an owner,
    // then fallback to admin
    setSelectedRole(selectedRole === 'owner' && canNotBeOwner ? 'admin' : selectedRole)
    setSelectedTeams(nextSelectedTeams)
  }

  return (
    <AddToTeam
      teamProfileAddList={teamProfileAddList}
      them={them}
      waiting={waiting}
      addUserToTeamsResults={addUserToTeamsResults}
      addUserToTeamsState={addUserToTeamsState}
      loadTeamList={loadTeamList}
      onBack={onBack}
      title={title}
      disabledReasonsForRolePicker={ownerDisabledReason ? {owner: ownerDisabledReason} : {}}
      onOpenRolePicker={() => setRolePickerOpen(true)}
      onConfirmRolePicker={role => {
        setRolePickerOpen(false)
        setSelectedRole(role)
      }}
      footerComponent={
        <>
          {sendNotificationFooter('Announce them in team chats', sendNotification, nextVal =>
            setSendNotification(nextVal)
          )}
        </>
      }
      isRolePickerOpen={rolePickerOpen}
      onCancelRolePicker={() => {
        setRolePickerOpen(false)
      }}
      selectedRole={selectedRole}
      onToggle={toggleTeamSelected}
      onSave={onSave}
      selectedTeams={selectedTeams}
    />
  )
}

export default Container
