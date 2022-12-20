import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {FloatingRolePicker} from '../role-picker'
import capitalize from 'lodash/capitalize'
import type {TeamRoleType} from '../../constants/types/teams'

export type Props = {
  errorMessage: string
  malformedEmails: Set<string>
  name: string
  onClearInviteError: () => void
  onClose: () => void
  onInvite: (invitees: string, role: TeamRoleType) => void
  waitingKey: string
}

const _makeDropdownItem = (item: string) => (
  <Kb.Box
    key={item}
    style={{
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
    }}
  >
    <Kb.Text type="BodyBig">{capitalize(item)}</Kb.Text>
  </Kb.Box>
)

type State = {
  invitees: string
  malformedEmails: Set<string>
  role: TeamRoleType
  isRolePickerOpen: boolean
}

class InviteByEmailDesktop extends React.Component<Props, State> {
  state = {
    invitees: '',
    isRolePickerOpen: false,
    malformedEmails: this.props.malformedEmails,
    role: 'reader' as TeamRoleType,
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

  onConfirmRolePicker = role => {
    this.setState({isRolePickerOpen: false, role})
  }

  onOpenRolePicker = () => {
    this.setState({isRolePickerOpen: true})
  }

  componentWillUnmount() {
    this.props.onClearInviteError()
  }

  _setMalformedEmails = (malformedEmails: Set<string>) => {
    this.setState({invitees: [...malformedEmails].join('\n'), malformedEmails})
  }

  _setRole = (role: TeamRoleType) => this.setState({role})

  _onInvite = () => this.props.onInvite(this.state.invitees, this.state.role)

  render() {
    const props = this.props
    return (
      <Kb.PopupDialog onClose={props.onClose} styleCover={styles.cover} styleContainer={styles.container}>
        <Kb.Box style={{...Styles.globalStyles.flexBoxColumn}}>
          <Kb.Box
            style={{
              ...Styles.globalStyles.flexBoxColumn,
              alignItems: 'center',
              margin: Styles.globalMargins.medium,
            }}
          >
            <Kb.Text style={styles.header} type="Header">
              Invite by email
            </Kb.Text>
            <Kb.Box
              style={{
                ...Styles.globalStyles.flexBoxRow,
                alignItems: 'center',
                margin: Styles.globalMargins.tiny,
              }}
            >
              <Kb.Text style={{margin: Styles.globalMargins.tiny}} type="Body">
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
                <Kb.Text type="BodySmall" style={{color: Styles.globalColors.redDark}}>
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

const styles = Styles.styleSheetCreate(() => ({
  container: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      alignSelf: 'center',
      backgroundColor: Styles.globalColors.white,
      borderRadius: 5,
    },
    isElectron: {
      ...Styles.desktopStyles.boxShadow,
    },
  }),
  cover: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingRolePicker: Styles.platformStyles({
    isElectron: {
      position: 'relative',
      top: -32,
    },
  }),
  header: {
    padding: Styles.globalMargins.tiny,
  },
}))

export {InviteByEmailDesktop}
