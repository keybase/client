import * as React from 'react'
import * as I from 'immutable'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {FloatingRolePicker} from '../role-picker'
import {capitalize} from 'lodash-es'
import {TeamRoleType} from '../../constants/types/teams'
import {pluralize} from '../../util/string'
import {DesktopProps as Props} from '.'

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
  malformedEmails: I.Set<string>
  role: TeamRoleType
  isRolePickerOpen: boolean
}

class InviteByEmailDesktop extends React.Component<Props, State> {
  state = {
    invitees: '',
    isRolePickerOpen: false,
    malformedEmails: I.Set(),
    role: 'reader' as TeamRoleType,
  }
  _input: Kb.Input | null = null

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

  onConfirmRolePicker = () => {
    this.setState({isRolePickerOpen: false})
  }

  onOpenRolePicker = () => {
    this.setState({isRolePickerOpen: true})
  }

  onSelectRole = (role: TeamRoleType) => {
    this.setState({role})
  }

  componentWillUnmount() {
    this.props.onClearInviteError()
  }

  _setMalformedEmails = (malformedEmails: I.Set<string>) => {
    this.setState({invitees: malformedEmails.join('\n'), malformedEmails})
  }

  _setRole = (role: TeamRoleType) => this.setState({role})

  _onInvite = () => this.props.onInvite(this.state.invitees, this.state.role)

  render() {
    const props = this.props
    return (
      <Kb.PopupDialog onClose={props.onClose} styleCover={_styleCover} styleContainer={_styleContainer}>
        <Kb.Box style={{...Styles.globalStyles.flexBoxColumn}}>
          <Kb.Box
            style={{
              ...Styles.globalStyles.flexBoxColumn,
              alignItems: 'center',
              margin: Styles.globalMargins.medium,
            }}
          >
            <Kb.Text style={styleInside} type="Header">
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
                confirmLabel={`Invite as ${pluralize(this.state.role)}`}
                selectedRole={this.state.role}
                onSelectRole={this.onSelectRole}
                floatingContainerStyle={styles.floatingRolePicker}
                onConfirm={this.onConfirmRolePicker}
                onCancel={this.onCancelRolePicker}
                position={'bottom center'}
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
            <Kb.Text type="BodySmallSemibold" style={{alignSelf: 'flex-start'}}>
              Enter multiple email addresses, separated by commas
            </Kb.Text>
            <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true} style={{alignItems: 'flex-start'}}>
              <Kb.Box
                style={{
                  border: `1px solid ${Styles.globalColors.black_20}`,
                  borderRadius: 4,
                  width: '100%',
                }}
              >
                <Kb.Input
                  autoFocus={true}
                  multiline={true}
                  hideUnderline={true}
                  onChangeText={invitees => this.setState({invitees})}
                  ref={i => (this._input = i)}
                  rowsMin={3}
                  rowsMax={8}
                  value={this.state.invitees}
                  style={styleInside}
                  small={true}
                  inputStyle={styleInput}
                />
              </Kb.Box>
              {props.errorMessage && (
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

const styleInside = {
  marginBottom: 0,
  marginTop: 0,
  padding: Styles.globalMargins.tiny,
}

const styleInput = {
  fontSize: 13,
  fontWeight: 'normal',
  textAlign: 'left',
} as const

const _styleCover = {
  alignItems: 'center',
  backgroundColor: Styles.globalColors.black,
  justifyContent: 'center',
}

const _styleContainer = {
  ...Styles.desktopStyles.boxShadow,
  ...Styles.globalStyles.flexBoxColumn,
  alignSelf: 'center',
  backgroundColor: Styles.globalColors.white,
  borderRadius: 5,
}

const styles = Styles.styleSheetCreate({
  floatingRolePicker: Styles.platformStyles({
    isElectron: {
      position: 'relative',
      top: -32,
    },
  }),
})

export {InviteByEmailDesktop}
