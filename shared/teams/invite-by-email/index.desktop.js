// @flow
import * as React from 'react'
import * as I from 'immutable'
import {
  Box,
  Box2,
  ButtonBar,
  DropdownButton,
  Input,
  PopupDialog,
  Text,
  WaitingButton,
} from '../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../styles'
import {capitalize} from 'lodash-es'
import {type TeamRoleType} from '../../constants/types/teams'
import type {DesktopProps as Props} from '.'

const _makeDropdownItem = (item: string) => (
  <Box
    key={item}
    style={{
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
      paddingLeft: globalMargins.small,
      paddingRight: globalMargins.small,
    }}
  >
    <Text type="BodyBig">{capitalize(item)}</Text>
  </Box>
)

type State = {
  invitees: string,
  malformedEmails: I.Set<string>,
  role: TeamRoleType,
}
class InviteByEmailDesktop extends React.Component<Props, State> {
  state = {invitees: '', malformedEmails: I.Set(), role: 'reader'}
  _input: ?Input

  componentDidUpdate(prevProps: Props, prevState: State) {
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

  componentWillUnmount() {
    this.props.onClearInviteError()
  }

  _setMalformedEmails = (malformedEmails: I.Set<string>) => {
    this.setState({malformedEmails, invitees: malformedEmails.join('\n')})
  }

  _setRole = (role: TeamRoleType) => this.setState({role})

  _onInvite = () => this.props.onInvite(this.state.invitees, this.state.role)

  render() {
    const props = this.props
    return (
      <PopupDialog onClose={props.onClose} styleCover={_styleCover} styleContainer={_styleContainer}>
        <Box style={{...globalStyles.flexBoxColumn}}>
          <Box
            style={{
              ...globalStyles.flexBoxColumn,
              alignItems: 'center',
              margin: globalMargins.medium,
            }}
          >
            <Text style={styleInside} type="Header">
              Invite by email
            </Text>
            <Box
              style={{
                ...globalStyles.flexBoxRow,
                alignItems: 'center',
                margin: globalMargins.tiny,
              }}
            >
              <Text style={{margin: globalMargins.tiny}} type="Body">
                Add these team members to {props.name} as:
              </Text>
              <DropdownButton
                toggleOpen={() => props.onOpenRolePicker(this.state.role, this._setRole)}
                selected={_makeDropdownItem(this.state.role)}
                style={{width: 100}}
              />
            </Box>
            <Text type="BodySmallSemibold" style={{alignSelf: 'flex-start'}}>
              Enter multiple email addresses, separated by commas
            </Text>
            <Box2 direction="vertical" gap="xtiny" fullWidth={true} style={{alignItems: 'flex-start'}}>
              <Box
                style={{
                  border: `1px solid ${globalColors.black_20}`,
                  borderRadius: 4,
                  width: '100%',
                }}
              >
                <Input
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
              </Box>
              {props.errorMessage && (
                <Text type="BodySmall" style={{color: globalColors.red}}>
                  {props.errorMessage}
                </Text>
              )}
            </Box2>

            <ButtonBar>
              <WaitingButton
                label="Invite"
                onClick={this._onInvite}
                type="Primary"
                waitingKey={props.waitingKey}
              />
            </ButtonBar>
          </Box>
        </Box>
      </PopupDialog>
    )
  }
}

const styleInside = {
  padding: globalMargins.tiny,
  marginTop: 0,
  marginBottom: 0,
}

const styleInput = {
  fontSize: 13,
  fontWeight: 'normal',
  textAlign: 'left',
}

const _styleCover = {
  alignItems: 'center',
  backgroundColor: globalColors.black_75,
  justifyContent: 'center',
}

const _styleContainer = {
  ...globalStyles.flexBoxColumn,
  alignSelf: 'center',
  backgroundColor: globalColors.white,
  borderRadius: 5,
  boxShadow: `0 2px 5px 0 ${globalColors.black_20}`,
}

export {InviteByEmailDesktop}
