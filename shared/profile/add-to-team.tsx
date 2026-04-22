import * as C from '@/constants'
import * as React from 'react'
import * as Teams from '@/stores/teams'
import * as T from '@/constants/types'
import {FloatingRolePicker, sendNotificationFooter} from '@/teams/role-picker'
import * as Kb from '@/common-adapters'
import {InlineDropdown} from '@/common-adapters/dropdown'
import logger from '@/logger'
import {useTeamsList} from '@/teams/use-teams-list'

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

const makeAddUserToTeamsResult = (
  user: string,
  teamsAddedTo: ReadonlyArray<string>,
  errorAddingTo: ReadonlyArray<string>
) => {
  let result = ''
  if (teamsAddedTo.length) {
    result += `${user} was added to `
    if (teamsAddedTo.length > 3) {
      result += `${teamsAddedTo[0]}, ${teamsAddedTo[1]}, and ${teamsAddedTo.length - 2} teams.`
    } else if (teamsAddedTo.length === 3) {
      result += `${teamsAddedTo[0]}, ${teamsAddedTo[1]}, and ${teamsAddedTo[2]}.`
    } else if (teamsAddedTo.length === 2) {
      result += `${teamsAddedTo[0]} and ${teamsAddedTo[1]}.`
    } else {
      result += `${teamsAddedTo[0]}.`
    }
  }

  if (errorAddingTo.length) {
    result += result.length > 0 ? ' But we ' : 'We '
    result += `were unable to add ${user} to ${errorAddingTo.join(', ')}.`
  }

  return result
}

type OwnProps = {username: string}
const Container = (ownProps: OwnProps) => {
  const {username: them} = ownProps
  const roles = Teams.useTeamsState(s => s.teamRoleMap.roles)
  const {teams} = useTeamsList()
  const teamNameToID = React.useMemo(() => new Map(teams.map(team => [team.teamname, team.id] as const)), [teams])
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyTeamsProfileAddList)
  const clearModals = C.Router2.clearModals
  const navigateUp = C.Router2.navigateUp
  const loadTeamProfileAddList = C.useRPC(T.RPCGen.teamsTeamProfileAddListRpcPromise)
  const addUserToTeam = C.useRPC(T.RPCGen.teamsTeamAddMemberRpcPromise)
  const [teamProfileAddList, setTeamProfileAddList] = React.useState<ReadonlyArray<T.Teams.TeamProfileAddList>>([])
  const [addUserToTeamsResults, setAddUserToTeamsResults] = React.useState('')
  const [addUserToTeamsState, setAddUserToTeamsState] =
    React.useState<T.Teams.AddUserToTeamsState>('notStarted')
  const teamListRequestID = React.useRef(0)
  const submitRequestID = React.useRef(0)

  // TODO Y2K-1086 use team ID given in teamProfileAddList to avoid this mapping
  const _teamNameToRole = teams.reduce(
    (res, curr) => res.set(curr.teamname, roles.get(curr.id)?.role || 'none'),
    new Map<string, T.Teams.MaybeTeamRoleType>()
  )
  const [selectedTeams, setSelectedTeams] = React.useState(new Set<string>())
  const [rolePickerOpen, setRolePickerOpen] = React.useState(false)
  const [selectedRole, setSelectedRole] = React.useState<T.Teams.TeamRoleType>('writer')
  const [sendNotification, setSendNotification] = React.useState(true)

  const ownerDisabledReason = getOwnerDisabledReason(selectedTeams, _teamNameToRole)

  React.useEffect(() => {
    return () => {
      teamListRequestID.current += 1
      submitRequestID.current += 1
    }
  }, [])

  const loadTeamList = React.useEffectEvent(() => {
    const requestID = teamListRequestID.current + 1
    teamListRequestID.current = requestID
    loadTeamProfileAddList(
      [{username: them}, C.waitingKeyTeamsProfileAddList],
      result => {
        if (teamListRequestID.current !== requestID) {
          return
        }
        const teamlist = (result ?? []).map(team => ({
          disabledReason: team.disabledReason,
          open: team.open,
          teamName: team.teamName.parts ? team.teamName.parts.join('.') : '',
        }))
        teamlist.sort((a, b) => a.teamName.localeCompare(b.teamName))
        setTeamProfileAddList(teamlist)
      },
      error => {
        if (teamListRequestID.current !== requestID) {
          return
        }
        logger.info(`Failed to load profile add-to-team list for ${them}: ${error.message}`)
        setTeamProfileAddList([])
      }
    )
  })

  const onAddToTeams = React.useEffectEvent(
    async (role: T.Teams.TeamRoleType, teams: Array<string>, sendChatNotification: boolean) => {
      const requestID = submitRequestID.current + 1
      submitRequestID.current = requestID
      setAddUserToTeamsResults('')
      setAddUserToTeamsState('notStarted')

      const teamsAddedTo: Array<string> = []
      const errorAddingTo: Array<string> = []

      for (const team of teams) {
        const teamID = teamNameToID.get(team)
        if (!teamID) {
          logger.warn(`no team ID found for ${team}`)
          errorAddingTo.push(team)
          continue
        }

        const added = await new Promise<boolean>(resolve => {
          addUserToTeam(
            [
              {
                email: '',
                phone: '',
                role: T.RPCGen.TeamRole[role],
                sendChatNotification,
                teamID,
                username: them,
              },
              [C.waitingKeyTeamsTeam(teamID), C.waitingKeyTeamsAddUserToTeams(them)],
            ],
            () => resolve(true),
            _ => resolve(false)
          )
        })

        if (submitRequestID.current !== requestID) {
          return
        }

        if (added) {
          teamsAddedTo.push(team)
        } else {
          errorAddingTo.push(team)
        }
      }

      if (submitRequestID.current !== requestID) {
        return
      }

      const result = makeAddUserToTeamsResult(them, teamsAddedTo, errorAddingTo)
      setAddUserToTeamsResults(result)
      if (errorAddingTo.length > 0) {
        setAddUserToTeamsState('failed')
        loadTeamList()
      } else {
        setAddUserToTeamsState('succeeded')
        clearModals()
      }
    }
  )

  React.useEffect(() => {
    setAddUserToTeamsResults('')
    setAddUserToTeamsState('notStarted')
    setSelectedTeams(new Set())
    setRolePickerOpen(false)
    setSelectedRole('writer')
    setSendNotification(true)
    setTeamProfileAddList([])
    loadTeamList()
  }, [them])

  const onBack = () => {
    navigateUp()
  }

  const onSave = () => {
    void onAddToTeams(selectedRole, [...selectedTeams], sendNotification)
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

  const selectedTeamCount = selectedTeams.size

  return (
    <>
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
                      onCheck={selected => {
                        onToggle(team.teamName, selected)
                      }}
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
      <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.modalFooter}>
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
      </Kb.Box2>
    </>
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

const TeamRow = (props: RowProps) => {
  return (
    <Kb.ClickableBox onClick={props.canAddThem ? () => props.onCheck(!props.checked) : undefined}>
      <Kb.Box2 direction="horizontal" style={styles.teamRow}>
        <Kb.Checkbox disabled={!props.canAddThem} checked={props.checked} onCheck={props.onCheck} />
        <Kb.Box2 direction="vertical" relative={true} style={{display: 'flex'}}>
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
              style={{
                color: props.canAddThem ? Kb.Styles.globalColors.black : Kb.Styles.globalColors.black_50,
              }}
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
}

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
      meta: {
        alignSelf: 'center',
        marginLeft: Kb.Styles.globalMargins.xtiny,
        marginTop: 2,
      },
      modalFooter: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
          borderStyle: 'solid' as const,
          borderTopColor: Kb.Styles.globalColors.black_10,
          borderTopWidth: 1,
          minHeight: 56,
        },
        isElectron: {
          borderBottomLeftRadius: Kb.Styles.borderRadius,
          borderBottomRightRadius: Kb.Styles.borderRadius,
          overflow: 'hidden',
        },
      }),
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
    }) as const
)

export default Container
