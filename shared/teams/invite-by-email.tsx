import * as C from '@/constants'
import type * as T from '@/constants/types'
import * as Teams from '@/stores/teams'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {FloatingRolePicker} from './role-picker'
import capitalize from 'lodash/capitalize'

type OwnProps = {teamID: string}

const Container = (ownProps: OwnProps) => {
  const teamID = ownProps.teamID
  const {teamname} = Teams.useTeamsState(s => Teams.getTeamMeta(s, teamID))
  const inviteError = Teams.useTeamsState(s => s.errorInEmailInvite)
  const errorMessage = inviteError.message
  const _malformedEmails = inviteError.malformed
  const name = teamname
  const waitingKey = C.waitingKeyTeamsAddToTeamByEmail(teamname) || ''
  const inviteToTeamByEmail = Teams.useTeamsState(s => s.dispatch.inviteToTeamByEmail)
  const resetErrorInEmailInvite = Teams.useTeamsState(s => s.dispatch.resetErrorInEmailInvite)
  // should only be called on unmount
  const onClearInviteError = resetErrorInEmailInvite
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const _onInvite = (invitees: string, role: T.Teams.TeamRoleType) => {
    inviteToTeamByEmail(invitees, role, teamID, teamname)
  }

  const [invitees, setInvitees] = React.useState('')
  const [role, setRole] = React.useState<T.Teams.TeamRoleType>('reader')
  const [isRolePickerOpen, setIsRolePickerOpen] = React.useState(false)

  const lastMalformedEmailsRef = React.useRef(_malformedEmails)
  React.useEffect(() => {
    if (lastMalformedEmailsRef.current !== _malformedEmails) {
      if (_malformedEmails.size > 0) {
        setInvitees([..._malformedEmails].join('\n'))
      } else if (!errorMessage) {
        navigateUp()
      }
    }
    lastMalformedEmailsRef.current = _malformedEmails
  }, [_malformedEmails, errorMessage, navigateUp])

  React.useEffect(() => {
    return () => {
      onClearInviteError()
    }
  }, [onClearInviteError])

  const onCancelRolePicker = () => setIsRolePickerOpen(false)
  const onConfirmRolePicker = (role: T.Teams.TeamRoleType) => {
    setIsRolePickerOpen(false)
    setRole(role)
  }
  const onOpenRolePicker = () => setIsRolePickerOpen(true)

  const onInvite = () => _onInvite(invitees, role)

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
