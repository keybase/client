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

type State = {
  invitees: string
  malformedEmails: ReadonlySet<string>
  role: T.Teams.TeamRoleType
  isRolePickerOpen: boolean
}

class InviteByEmailDesktop extends React.Component<Props, State> {
  state = {
    invitees: '',
    isRolePickerOpen: false,
    malformedEmails: this.props.malformedEmails,
    role: 'reader' as T.Teams.TeamRoleType,
  }

  componentDidUpdate(_: Props, prevState: State) {
    // update contents of input box if we get a new list of malformed emails
    if (this.props.malformedEmails !== prevState.malformedEmails) {
      if (this.props.malformedEmails.size > 0) {
        this._setMalformedEmails(this.props.malformedEmails)
      } else if (!this.props.errorMessage) {
        // we just invited successfully
        this.props.onClose()
      }
    }
  }

  onCancelRolePicker = () => {
    this.setState({isRolePickerOpen: false})
  }

  onConfirmRolePicker = (role: T.Teams.TeamRoleType) => {
    this.setState({isRolePickerOpen: false, role})
  }

  onOpenRolePicker = () => {
    this.setState({isRolePickerOpen: true})
  }

  componentWillUnmount() {
    this.props.onClearInviteError()
  }

  _setMalformedEmails = (malformedEmails: ReadonlySet<string>) => {
    this.setState({invitees: [...malformedEmails].join('\n'), malformedEmails})
  }

  _setRole = (role: T.Teams.TeamRoleType) => this.setState({role})

  _onInvite = () => this.props.onInvite(this.state.invitees, this.state.role)

  render() {
    const props = this.props
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
                presetRole={this.state.role}
                floatingContainerStyle={styles.floatingRolePicker}
                onConfirm={this.onConfirmRolePicker}
                onCancel={this.onCancelRolePicker}
                position="bottom center"
                open={this.state.isRolePickerOpen}
                disabledRoles={{owner: 'Cannot invite an owner via email.'}}
              >
                <Kb.DropdownButton
                  toggleOpen={this.onOpenRolePicker}
                  selected={_makeDropdownItem(this.state.role)}
                  style={{width: 100}}
                />
              </FloatingRolePicker>
            </Kb.Box>
            <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true} style={{alignItems: 'flex-start'}}>
              <Kb.LabeledInput
                autoFocus={true}
                error={!!props.errorMessage}
                multiline={true}
                onChangeText={invitees => this.setState({invitees})}
                placeholder="Enter multiple email addresses, separated by commas"
                rowsMin={3}
                rowsMax={8}
                value={this.state.invitees}
              />
              {!!props.errorMessage && (
                <Kb.Text type="BodySmall" style={{color: Kb.Styles.globalColors.redDark}}>
                  {props.errorMessage}
                </Kb.Text>
              )}
            </Kb.Box2>
            <Kb.ButtonBar>
              <Kb.WaitingButton label="Invite" onClick={this._onInvite} waitingKey={props.waitingKey} />
            </Kb.ButtonBar>
          </Kb.Box>
        </Kb.Box>
      </Kb.PopupDialog>
    )
  }
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
