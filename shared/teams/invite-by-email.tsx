import * as C from '@/constants'
import type * as T from '@/constants/types'
import * as Teams from '@/stores/teams'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {FloatingRolePicker} from './role-picker'
import capitalize from 'lodash/capitalize'

type OwnProps = {teamID: string}

const malformedEmailErrorMessage = (malformed: ReadonlyArray<string>) =>
  C.isMobile
    ? `Error parsing email: ${malformed[0]}`
    : `There was an error parsing ${malformed.length} address${malformed.length > 1 ? 'es' : ''}.`

const Container = (ownProps: OwnProps) => {
  const teamID = ownProps.teamID
  const {teamname} = Teams.useTeamsState(s => Teams.getTeamMeta(s, teamID))
  const name = teamname
  const waitingKey = C.waitingKeyTeamsAddToTeamByEmail(teamname) || ''
  const inviteToTeamByEmail = C.useRPC(T.RPCGen.teamsTeamAddEmailsBulkRpcPromise)
  const navigateUp = C.Router2.navigateUp

  const [invitees, setInvitees] = React.useState('')
  const [role, setRole] = React.useState<T.Teams.TeamRoleType>('reader')
  const [isRolePickerOpen, setIsRolePickerOpen] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState('')

  const onCancelRolePicker = () => setIsRolePickerOpen(false)
  const onConfirmRolePicker = (role: T.Teams.TeamRoleType) => {
    setIsRolePickerOpen(false)
    setRole(role)
  }
  const onOpenRolePicker = () => setIsRolePickerOpen(true)

  const onInvite = () => {
    setErrorMessage('')
    inviteToTeamByEmail(
      [
        {
          emails: invitees,
          name: teamname,
          role: T.RPCGen.TeamRole[role],
        },
        [C.waitingKeyTeamsTeam(teamID), waitingKey],
      ],
      res => {
        const malformed = res.malformed ?? []
        if (malformed.length > 0) {
          setInvitees(malformed.join('\n'))
          setErrorMessage(malformedEmailErrorMessage(malformed))
          return
        }
        if (C.isMobile) {
          navigateUp()
        } else {
          C.Router2.clearModals()
        }
      },
      error => {
        setErrorMessage(error.desc)
      }
    )
  }

  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Box2
        direction="vertical"
        alignItems="center"
        fullWidth={true}
        style={{margin: Kb.Styles.globalMargins.medium}}
      >
        <Kb.Text style={styles.header} type="Header">
          Invite by email
        </Kb.Text>
        <Kb.Box2
          direction="horizontal"
          alignItems="center"
          style={{margin: Kb.Styles.globalMargins.tiny}}
        >
          <Kb.Text style={{margin: Kb.Styles.globalMargins.tiny}} type="Body">
            Add these team members to {name} as:
          </Kb.Text>
          <FloatingRolePicker
            presetRole={role}

            onConfirm={onConfirmRolePicker}
            onCancel={onCancelRolePicker}
            position="bottom center"
            open={isRolePickerOpen}
            disabledRoles={{owner: 'Cannot invite an owner via email.'}}
          >
            <Kb.DropdownButton
              toggleOpen={onOpenRolePicker}
              selected={_makeDropdownItem(role)}
              style={{width: 100}}
            />
          </FloatingRolePicker>
        </Kb.Box2>
        <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true} alignItems="flex-start">
          <Kb.Input3
            autoFocus={true}
            error={!!errorMessage}
            multiline={true}
            onChangeText={setInvitees}
            placeholder="Enter multiple email addresses, separated by commas"
            rowsMin={3}
            rowsMax={8}
            value={invitees}
          />
          {!!errorMessage && (
            <Kb.Text type="BodySmall" style={{color: Kb.Styles.globalColors.redDark}}>
              {errorMessage}
            </Kb.Text>
          )}
        </Kb.Box2>
        <Kb.ButtonBar>
          <Kb.WaitingButton label="Invite" onClick={onInvite} waitingKey={waitingKey} />
        </Kb.ButtonBar>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const _makeDropdownItem = (item: string) => (
  <Kb.Box2
    key={item}
    direction="horizontal"
    alignItems="center"
    style={{
      paddingLeft: Kb.Styles.globalMargins.small,
      paddingRight: Kb.Styles.globalMargins.small,
    }}
  >
    <Kb.Text type="BodyBig">{capitalize(item)}</Kb.Text>
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(() => ({
  header: {padding: Kb.Styles.globalMargins.tiny},
}))

export default Container
