import * as React from 'react'
import * as Kb from '@/common-adapters'
import {FloatingRolePicker} from '../role-picker'
import capitalize from 'lodash/capitalize'
import type * as T from '@/constants/types'

export type Props = {
  errorMessage: string
  malformedEmails: ReadonlySet<string>
  name: string
  onClearInviteError: () => void
  onClose: () => void
  onInvite: (invitees: string, role: T.Teams.TeamRoleType) => void
  waitingKey: string
}

const _makeDropdownItem = (item: string) => (
  <Kb.Box
    key={item}
    style={{
      ...Kb.Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      paddingLeft: Kb.Styles.globalMargins.small,
      paddingRight: Kb.Styles.globalMargins.small,
    }}
  >
    <Kb.Text type="BodyBig">{capitalize(item)}</Kb.Text>
  </Kb.Box>
)

const InviteByEmailDesktop = (props: Props) => {
  const {onClearInviteError, onClose, malformedEmails: _malformedEmails, errorMessage} = props
  const [invitees, setInvitees] = React.useState('')
  const [role, setRole] = React.useState<T.Teams.TeamRoleType>('reader')
  const [isRolePickerOpen, setIsRolePickerOpen] = React.useState(false)

  const lastMalformedEmailsRef = React.useRef(_malformedEmails)
  React.useEffect(() => {
    if (lastMalformedEmailsRef.current !== _malformedEmails) {
      if (_malformedEmails.size > 0) {
        setInvitees([..._malformedEmails].join('\n'))
      } else if (!errorMessage) {
        onClose()
      }
    }
    lastMalformedEmailsRef.current = _malformedEmails
  }, [_malformedEmails, errorMessage, onClose])

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

  const onInvite = () => props.onInvite(invitees, role)

  return (
    <Kb.PopupDialog onClose={props.onClose} styleCover={styles.cover} styleContainer={styles.container}>
      <Kb.Box style={{...Kb.Styles.globalStyles.flexBoxColumn}}>
        <Kb.Box
          style={{
            ...Kb.Styles.globalStyles.flexBoxColumn,
            alignItems: 'center',
            margin: Kb.Styles.globalMargins.medium,
          }}
        >
          <Kb.Text style={styles.header} type="Header">
            Invite by email
          </Kb.Text>
          <Kb.Box
            style={{
              ...Kb.Styles.globalStyles.flexBoxRow,
              alignItems: 'center',
              margin: Kb.Styles.globalMargins.tiny,
            }}
          >
            <Kb.Text style={{margin: Kb.Styles.globalMargins.tiny}} type="Body">
              Add these team members to {props.name} as:
            </Kb.Text>
            <FloatingRolePicker
              presetRole={role}
              floatingContainerStyle={styles.floatingRolePicker}
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
          </Kb.Box>
          <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true} style={{alignItems: 'flex-start'}}>
            <Kb.LabeledInput
              autoFocus={true}
              error={!!props.errorMessage}
              multiline={true}
              onChangeText={setInvitees}
              placeholder="Enter multiple email addresses, separated by commas"
              rowsMin={3}
              rowsMax={8}
              value={invitees}
            />
            {!!props.errorMessage && (
              <Kb.Text type="BodySmall" style={{color: Kb.Styles.globalColors.redDark}}>
                {props.errorMessage}
              </Kb.Text>
            )}
          </Kb.Box2>
          <Kb.ButtonBar>
            <Kb.WaitingButton label="Invite" onClick={onInvite} waitingKey={props.waitingKey} />
          </Kb.ButtonBar>
        </Kb.Box>
      </Kb.Box>
    </Kb.PopupDialog>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.globalStyles.flexBoxColumn,
      alignSelf: 'center',
      backgroundColor: Kb.Styles.globalColors.white,
      borderRadius: 5,
    },
    isElectron: {
      ...Kb.Styles.desktopStyles.boxShadow,
    },
  }),
  cover: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingRolePicker: Kb.Styles.platformStyles({
    isElectron: {
      position: 'relative',
      top: -32,
    },
  }),
  header: {
    padding: Kb.Styles.globalMargins.tiny,
  },
}))

export {InviteByEmailDesktop}
