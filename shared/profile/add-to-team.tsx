import * as C from '@/constants'
import * as React from 'react'
import * as Teams from '@/constants/teams'
import * as T from '@/constants/types'
import {FloatingRolePicker, sendNotificationFooter} from '@/teams/role-picker'
import * as Kb from '@/common-adapters'
import {InlineDropdown} from '@/common-adapters/dropdown'
import logger from '@/logger'
import {useRPCLoad} from '@/util/use-rpc-load'
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

const noTeamList = new Array<T.Teams.TeamProfileAddList>()

const AddToTeam = (ownProps: OwnProps) => {
  const {username: them} = ownProps
  const {teams} = useTeamsList()
  const teamNameToID = React.useMemo(() => new Map(teams.map(team => [team.teamname, team.id] as const)), [teams])
  const teamNameToRole = React.useMemo(
    () => new Map(teams.map(team => [team.teamname, team.role] as const)),
    [teams]
  )
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyTeamsProfileAddList)
  const clearModals = C.Router2.clearModals
  const navigateUp = C.Router2.navigateUp
  const addUserToTeam = C.useRPC(T.RPCGen.teamsTeamAddMemberRpcPromise)
  const [addUserToTeamsResults, setAddUserToTeamsResults] = React.useState('')
  const [addUserToTeamsState, setAddUserToTeamsState] =
    React.useState<T.Teams.AddUserToTeamsState>('notStarted')
  const submitRequestID = React.useRef(0)

  const {data: teamProfileAddList = noTeamList, reload: loadTeamList} = useRPCLoad(
    T.RPCGen.teamsTeamProfileAddListRpcPromise,
    [{username: them}, C.waitingKeyTeamsProfileAddList],
    {
      map: result => {
        const teamlist = (result ?? []).map(team => ({
          disabledReason: team.disabledReason,
          open: team.open,
          teamName: team.teamName.parts ? team.teamName.parts.join('.') : '',
        }))
        teamlist.sort((a, b) => a.teamName.localeCompare(b.teamName))
        return teamlist
      },
      onError: error => logger.info(`Failed to load profile add-to-team list for ${them}: ${error.message}`),
    }
  )

  // TODO Y2K-1086 use team ID given in teamProfileAddList to avoid this mapping
  const [selectedTeams, setSelectedTeams] = React.useState(new Set<string>())
  const [rolePickerOpen, setRolePickerOpen] = React.useState(false)
  const [selectedRole, setSelectedRole] = React.useState<T.Teams.TeamRoleType>('writer')
  const [sendNotification, setSendNotification] = React.useState(true)

  const ownerDisabledReason = getOwnerDisabledReason(selectedTeams, teamNameToRole)

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
    return () => {
      submitRequestID.current += 1
    }
  }, [])

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
    const canNotBeOwner = !!getOwnerDisabledReason(nextSelectedTeams, teamNameToRole)

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
  const onCancelRolePicker = () => {
    setRolePickerOpen(false)
  }
  const footerComponent = sendNotificationFooter('Announce them in team chats', sendNotification, nextVal =>
    setSendNotification(nextVal)
  )

  const selectedTeamCount = selectedTeams.size

  return (
    <>
      <Kb.Box2 direction="vertical" alignItems="center" fullWidth={true} fullHeight={true} style={styles.container} gap="xsmall" gapStart={true}>
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
          <Kb.Avatar isTeam={false} size={16} style={styles.headerAvatar} username={them} />
          <Kb.Text type="Header">{them} to...</Kb.Text>
        </Kb.Box2>
        <Kb.BoxGrow style={styles.boxGrow}>
          <Kb.ScrollView style={Kb.Styles.size('100%')}>
            <Kb.Box2 direction="vertical" fullWidth={true} style={styles.teamListInner}>
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
                        toggleTeamSelected(team.teamName, selected)
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
                  <Kb.ProgressIndicator style={styles.progress} />
                </Kb.Box2>
              )}
            </Kb.Box2>
          </Kb.ScrollView>
        </Kb.BoxGrow>
        <Kb.Box2 direction="horizontal" noShrink={true} alignItems="center" style={styles.addToTeam}>
          <Kb.Text style={styles.addToTeamTitle} type="BodySmall">
            {them} will be added as a
          </Kb.Text>
          <FloatingRolePicker
            presetRole={selectedRole}

            footerComponent={footerComponent}
            onConfirm={onConfirmRolePicker}
            onCancel={onCancelRolePicker}
            position="top center"
            open={rolePickerOpen}
            disabledRoles={disabledReasonsForRolePicker}
          >
            <InlineDropdown textWrapperType="BodySmall" label={selectedRole} onPress={onOpenRolePicker} />
          </FloatingRolePicker>
        </Kb.Box2>
      </Kb.Box2>
      <Kb.ModalFooter>
        <Kb.ButtonBar small={true} fullWidth={true} style={styles.buttonBar}>
          {!isMobile && <Kb.Button type="Dim" onClick={onBack} label="Cancel" />}
          <Kb.WaitingButton
            disabled={selectedTeamCount === 0}
            fullWidth={isMobile}
            style={styles.addButton}
            onClick={onSave}
            label={selectedTeamCount <= 1 ? 'Add to team' : `Add to ${selectedTeamCount} teams`}
            waitingKey={C.waitingKeyTeamsAddUserToTeams(them)}
          />
        </Kb.ButtonBar>
      </Kb.ModalFooter>
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
    <Kb.ClickableBox direction="vertical" fullWidth={true} onClick={props.canAddThem ? () => props.onCheck(!props.checked) : undefined}>
      <Kb.Box2 direction="horizontal" alignItems="center" fullWidth={true} style={styles.teamRow}>
        <Kb.Checkbox disabled={!props.canAddThem} checked={props.checked} onCheck={props.onCheck} />
        <Kb.Avatar
          isTeam={true}
          size={isMobile ? 48 : 32}
          style={styles.teamRowAvatar}
          teamname={props.name}
        />
        <Kb.Box2 direction="vertical">
          <Kb.Box2 direction="horizontal" alignSelf="flex-start">
            <Kb.Text
              style={props.canAddThem ? styles.teamNameEnabled : styles.teamNameDisabled}
              type="BodySemibold"
            >
              {props.name}
            </Kb.Text>
            {props.isOpen && (
              <Kb.Meta variant="open" style={styles.meta} />
            )}
          </Kb.Box2>
          <Kb.Text type="BodySmall">{props.disabledReason}</Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
      {!isMobile && <Kb.Divider style={styles.divider} />}
    </Kb.ClickableBox>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      addButton: Kb.Styles.platformStyles({
        isMobile: {width: '100%'},
      }),
      boxGrow: {width: '100%'},
      progress: {width: 64},
      teamListInner: {flexShrink: 1},
      addToTeam: Kb.Styles.platformStyles({
        common: {
          flexWrap: 'wrap',
          marginBottom: Kb.Styles.globalMargins.small,
          ...Kb.Styles.marginH(Kb.Styles.globalMargins.small),
        },
        isElectron: {marginTop: Kb.Styles.globalMargins.small},
      }),
      addToTeamTitle: Kb.Styles.platformStyles({
        common: {marginRight: Kb.Styles.globalMargins.tiny},
        isMobile: {
          ...Kb.Styles.marginV(Kb.Styles.globalMargins.tiny),
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
          ...Kb.Styles.paddingH(Kb.Styles.globalMargins.xsmall),
        },
      }),
      container: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.white,
          flexGrow: 1,
          flexShrink: 1,
        },
        isElectron: {maxHeight: '100%'},
      }),
      divider: {marginLeft: 69},
      headerAvatar: Kb.Styles.platformStyles({
        isElectron: {...Kb.Styles.marginH(Kb.Styles.globalMargins.tiny)},
        isMobile: {marginLeft: Kb.Styles.globalMargins.xxtiny, marginRight: Kb.Styles.globalMargins.tiny},
      }),
      meta: {
        marginLeft: Kb.Styles.globalMargins.xtiny,
        marginTop: 2,
      },
      teamNameDisabled: {color: Kb.Styles.globalColors.black_50},
      teamNameEnabled: {color: Kb.Styles.globalColors.black},
      teamRowAvatar: {marginRight: Kb.Styles.globalMargins.tiny},
      teamRow: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.paddingV(Kb.Styles.globalMargins.tiny),
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

export default AddToTeam
