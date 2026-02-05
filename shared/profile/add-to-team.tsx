import * as C from '@/constants'
import * as React from 'react'
import * as Teams from '@/constants/teams'
import type * as T from '@/constants/types'
import {FloatingRolePicker, sendNotificationFooter} from '@/teams/role-picker'
import * as Kb from '@/common-adapters'
import {InlineDropdown} from '@/common-adapters/dropdown'

const getOwnerDisabledReason = (
  selected: Set<string>,
  teamNameToRole: Map<string, T.Teams.MaybeTeamRoleType>
) => {
  return [...selected]
    .map(teamName => {
      if (Teams.isSubteam(teamName)) {
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
  const roles = Teams.useTeamsState(s => s.teamRoleMap.roles)
  const teams = Teams.useTeamsState(s => s.teamMeta)
  const addUserToTeamsResults = Teams.useTeamsState(s => s.addUserToTeamsResults)
  const addUserToTeamsState = Teams.useTeamsState(s => s.addUserToTeamsState)
  const clearAddUserToTeamsResults = Teams.useTeamsState(s => s.dispatch.clearAddUserToTeamsResults)
  const addUserToTeams = Teams.useTeamsState(s => s.dispatch.addUserToTeams)
  const teamProfileAddList = Teams.useTeamsState(s => s.teamProfileAddList)
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyTeamsProfileAddList)
  const _onAddToTeams = addUserToTeams
  const getTeamProfileAddList = Teams.useTeamsState(s => s.dispatch.getTeamProfileAddList)
  const resetTeamProfileAddList = Teams.useTeamsState(s => s.dispatch.resetTeamProfileAddList)
  const loadTeamList = React.useCallback(() => {
    getTeamProfileAddList(them)
  }, [getTeamProfileAddList, them])
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = React.useCallback(() => {
    navigateUp()
    resetTeamProfileAddList()
  }, [navigateUp, resetTeamProfileAddList])

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

  const disabledReasonsForRolePicker = ownerDisabledReason ? {owner: ownerDisabledReason} : {}
  const onOpenRolePicker = () => setRolePickerOpen(true)

  const onConfirmRolePicker = (role: T.Teams.TeamRoleType) => {
    setRolePickerOpen(false)
    setSelectedRole(role)
  }
  const footerComponent = (
    <>
      {sendNotificationFooter('Announce them in team chats', sendNotification, nextVal =>
        setSendNotification(nextVal)
      )}
    </>
  )

  const isRolePickerOpen = rolePickerOpen
  const onCancelRolePicker = () => {
    setRolePickerOpen(false)
  }
  const onToggle = toggleTeamSelected

  React.useEffect(() => {
    if (addUserToTeamsState === 'succeeded') {
      // If we succeeded, close the modal
      onBack()
    } else if (addUserToTeamsState === 'failed') {
      // If we failed, reload the team list -- some teams might have succeeded
      // and should be updated.
      loadTeamList()
    }
  }, [addUserToTeamsState, onBack, loadTeamList])

  const selectedTeamCount = selectedTeams.size

  return (
    <Kb.Modal2
      header={
        Kb.Styles.isMobile
          ? {
              leftButton: (
                <Kb.Text type="BodyBigLink" onClick={onBack}>
                  Cancel
                </Kb.Text>
              ),
            }
          : undefined
      }
      footer={{
        content: (
          <Kb.ButtonBar fullWidth={true} style={styles.buttonBar}>
            {!Kb.Styles.isMobile && <Kb.Button type="Dim" onClick={onBack} label="Cancel" />}
            <Kb.WaitingButton
              disabled={selectedTeamCount === 0}
              fullWidth={Kb.Styles.isMobile}
              style={styles.addButton}
              onClick={onSave}
              label={selectedTeamCount <= 1 ? 'Add to team' : `Add to ${selectedTeamCount} teams`}
              waitingKey={C.waitingKeyTeamsAddUserToTeams(them)}
            />
          </Kb.ButtonBar>
        ),
      }}
    >
      <Kb.Box2 direction="vertical" style={styles.container} gap="xsmall" gapStart={true}>
        {addUserToTeamsState === 'failed' && (
          <Kb.Box2
            direction="horizontal"
            fullWidth={true}
            noShrink={true}
            style={styles.addUserToTeamsResultsBox}
          >
            <Kb.Text style={styles.addUserToTeamsResultsText} type="BodySemibold" negative={true}>
              {addUserToTeamsResults}
            </Kb.Text>
          </Kb.Box2>
        )}
        <Kb.Box2 direction="horizontal">
          <Kb.Text type="Header">Add</Kb.Text>
          <Kb.Avatar
            isTeam={false}
            size={16}
            style={{
              marginLeft: Kb.Styles.isMobile ? Kb.Styles.globalMargins.xxtiny : Kb.Styles.globalMargins.tiny,
              marginRight: Kb.Styles.globalMargins.tiny,
            }}
            username={them}
          />
          <Kb.Text type="Header">{them} to...</Kb.Text>
        </Kb.Box2>
        <Kb.BoxGrow style={{width: '100%'}}>
          <Kb.ScrollView style={{height: '100%', width: '100%'}}>
            <Kb.Box2 direction="vertical" style={{flexShrink: 1, width: '100%'}}>
              {!waiting ? (
                teamProfileAddList.length > 0 ? (
                  teamProfileAddList.map(team => (
                    <TeamRow
                      canAddThem={!team.disabledReason}
                      checked={selectedTeams.has(team.teamName)}
                      disabledReason={team.disabledReason}
                      key={team.teamName}
                      name={team.teamName}
                      isOpen={team.open}
                      onCheck={selected => onToggle(team.teamName, selected)}
                      them={them}
                    />
                  ))
                ) : (
                  <Kb.Box2 direction="vertical" centerChildren={true}>
                    <Kb.Text center={true} type="Body">
                      {"Looks like you haven't joined any teams yet yourself!"}
                    </Kb.Text>
                    <Kb.Text center={true} type="Body">
                      You can join teams over in the Teams tab.
                    </Kb.Text>
                  </Kb.Box2>
                )
              ) : (
                <Kb.Box2 direction="vertical" centerChildren={true}>
                  <Kb.ProgressIndicator style={{width: 64}} />
                </Kb.Box2>
              )}
            </Kb.Box2>
          </Kb.ScrollView>
        </Kb.BoxGrow>
        <Kb.Box2 direction="horizontal" style={styles.addToTeam}>
          <Kb.Text style={styles.addToTeamTitle} type="BodySmall">
            {them} will be added as a
          </Kb.Text>
          <FloatingRolePicker
            presetRole={selectedRole}
            floatingContainerStyle={styles.floatingRolePicker}
            footerComponent={footerComponent}
            onConfirm={onConfirmRolePicker}
            onCancel={onCancelRolePicker}
            position="top center"
            open={isRolePickerOpen}
            disabledRoles={disabledReasonsForRolePicker}
          >
            <InlineDropdown textWrapperType="BodySmall" label={selectedRole} onPress={onOpenRolePicker} />
          </FloatingRolePicker>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Modal2>
  )
}

type RowProps = {
  canAddThem: boolean
  checked: boolean
  disabledReason: string
  name: T.Teams.Teamname
  isOpen: boolean
  onCheck: (selected: boolean) => void
  them: string
}

// This state is handled by the state wrapper in the container
export type ComponentState = {
  selectedTeams: Set<string>
  onSave: () => void
  onToggle: (teamName: string, selected: boolean) => void
}

export type AddToTeamProps = {
  title: string
  addUserToTeamsResults: string
  addUserToTeamsState: T.Teams.AddUserToTeamsState
  loadTeamList: () => void
  onBack: () => void
  teamProfileAddList: ReadonlyArray<T.Teams.TeamProfileAddList>
  them: string
  waiting: boolean
}

const TeamRow = (props: RowProps) => (
  <Kb.ClickableBox onClick={props.canAddThem ? () => props.onCheck(!props.checked) : undefined}>
    <Kb.Box2 direction="horizontal" style={styles.teamRow}>
      <Kb.Box2 direction="horizontal" pointerEvents="none">
        <Kb.Checkbox disabled={!props.canAddThem} checked={props.checked} onCheck={props.onCheck} />
      </Kb.Box2>
      <Kb.Box2 direction="vertical" style={{display: 'flex', position: 'relative'}}>
        <Kb.Avatar
          isTeam={true}
          size={Kb.Styles.isMobile ? 48 : 32}
          style={{marginRight: Kb.Styles.globalMargins.tiny}}
          teamname={props.name}
        />
      </Kb.Box2>
      <Kb.Box2 direction="vertical">
        <Kb.Box2 direction="horizontal" style={{alignSelf: 'flex-start'}}>
          <Kb.Text
            style={{color: props.canAddThem ? Kb.Styles.globalColors.black : Kb.Styles.globalColors.black_50}}
            type="BodySemibold"
          >
            {props.name}
          </Kb.Text>
          {props.isOpen && (
            <Kb.Meta title="open" style={styles.meta} backgroundColor={Kb.Styles.globalColors.green} />
          )}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" style={{alignSelf: 'flex-start'}}>
          <Kb.Text type="BodySmall">{props.disabledReason}</Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
    {!Kb.Styles.isMobile && <Kb.Divider style={styles.divider} />}
  </Kb.ClickableBox>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      addButton: Kb.Styles.platformStyles({
        isMobile: {width: '100%'},
      }),
      addToTeam: Kb.Styles.platformStyles({
        common: {
          alignItems: 'center',
          flexShrink: 0,
          flexWrap: 'wrap',
          marginBottom: Kb.Styles.globalMargins.small,
          marginLeft: Kb.Styles.globalMargins.small,
          marginRight: Kb.Styles.globalMargins.small,
        },
        isElectron: {marginTop: Kb.Styles.globalMargins.small},
      }),
      addToTeamTitle: Kb.Styles.platformStyles({
        common: {marginRight: Kb.Styles.globalMargins.tiny},
        isMobile: {
          marginBottom: Kb.Styles.globalMargins.tiny,
          marginTop: Kb.Styles.globalMargins.tiny,
        },
      }),
      addUserToTeamsResultsBox: {
        backgroundColor: Kb.Styles.globalColors.red,
        marginBottom: Kb.Styles.globalMargins.small,
      },
      addUserToTeamsResultsText: {
        margin: Kb.Styles.globalMargins.tiny,
        textAlign: 'center',
        width: '100%',
      },
      buttonBar: Kb.Styles.platformStyles({
        isMobile: {
          paddingLeft: Kb.Styles.globalMargins.xsmall,
          paddingRight: Kb.Styles.globalMargins.xsmall,
        },
      }),
      container: Kb.Styles.platformStyles({
        common: {
          alignItems: 'center',
          backgroundColor: Kb.Styles.globalColors.white,
          flexGrow: 1,
          flexShrink: 1,
          height: '100%',
          width: '100%',
        },
        isElectron: {maxHeight: '100%'},
      }),
      divider: {marginLeft: 69},
      floatingRolePicker: Kb.Styles.platformStyles({
        isElectron: {
          bottom: -32,
          position: 'relative',
        },
      }),
      meta: {
        alignSelf: 'center',
        marginLeft: Kb.Styles.globalMargins.xtiny,
        marginTop: 2,
      },
      teamRow: Kb.Styles.platformStyles({
        common: {
          alignItems: 'center',
          paddingBottom: Kb.Styles.globalMargins.tiny,
          paddingTop: Kb.Styles.globalMargins.tiny,
          width: '100%',
        },
        isElectron: {
          minHeight: 48,
          paddingLeft: Kb.Styles.globalMargins.tiny,
        },
        isMobile: {
          minHeight: 64,
          paddingLeft: Kb.Styles.globalMargins.xsmall,
          paddingRight: Kb.Styles.globalMargins.tiny,
        },
      }),
      wrapper: Kb.Styles.platformStyles({
        common: {},
        isElectron: {maxHeight: '80%'},
        isMobile: {flexGrow: 1},
      }),
    }) as const
)

export default Container
