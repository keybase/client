// @flow
import * as React from 'react'
import {Box, Button, ClickableBox, Dropdown, Input, PopupDialog, Text} from '../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../styles'
import capitalize from 'lodash/capitalize'
import {isMobile} from '../../constants/platform'

import {type TeamRoleType} from '../../constants/teams'

const MaybePopup = isMobile
  ? (props: {onClose: () => void, children: React.Node}) => (
      <Box style={{height: '100%', width: '100%'}} children={props.children} />
    )
  : (props: {onClose: () => void, children: React.Node}) => (
      <PopupDialog
        onClose={props.onClose}
        styleCover={_styleCover}
        styleContainer={_styleContainer}
        children={props.children}
      />
    )

type Props = {
  invitees: string,
  name: string,
  onInvite: () => void,
  onClose: () => void,
}

class InviteByEmail extends React.Component<Props, void> {
  _makeDropdownItem = (item: string) => {
    return (
      <Box
        key={item}
        style={{
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          paddingLeft: globalMargins.small,
          paddingRight: globalMargins.small,
        }}
      >
        <Text type="Body">{capitalize(item)}</Text>
      </Box>
    )
  }

  _makeDropdownItems = () => ['admin', 'owner', 'reader', 'writer'].map(item => this._makeDropdownItem(item))

  _dropdownChanged = (node: React.Node) => {
    // $FlowIssue doesn't understand key will be string
    const selectedRole: TeamRoleType = (node && node.key) || null
    this.props.onRoleChange(selectedRole)
  }

  _openRolePicker = () => {
    this.props.onOpenRolePicker(this.props.role, (selectedRole: TeamRoleType) =>
      this.props.onRoleChange(selectedRole)
    )
  }

  render = () => (
    <MaybePopup onClose={this.props.onClose}>
      <Box style={{...globalStyles.flexBoxColumn}}>
        <Box
          style={{
            ...globalStyles.flexBoxColumn,
            alignItems: 'center',
            margin: globalMargins.large,
          }}
        >
          <Text style={styleInside} type="Header">Invite by email</Text>
          <Box style={{...globalStyles.flexBoxRow,
          alignItems: 'center', margin: globalMargins.tiny}}>
            <Text style={{margin: globalMargins.tiny}} type="Body">
              Add these team members to {this.props.name} as:
            </Text>
            <ClickableBox onClick={this._openRolePicker}>
              <Dropdown
                items={this._makeDropdownItems()}
                selected={this._makeDropdownItem(this.props.role)}
                onChanged={this._dropdownChanged}
              />
            </ClickableBox>
          </Box>
          <Input
            autoFocus={true}
            hintText="Email addresses"
            multiline={true}
            onChangeText={invitees => this.props.onInviteesChange(invitees)}
            rowsMin={3}
            rowsMax={8}
            style={styleInside}
            value={this.props.invitees}
          />
          <Button label="Invite" onClick={this.props.onInvite} type="Primary" />
        </Box>
      </Box>
    </MaybePopup>
  )
}
const styleInside = {
  padding: globalMargins.small,
}

const _styleCover = {
  alignItems: 'stretch',
  backgroundColor: globalColors.black_75,
  justifyContent: 'stretch',
}

const _styleContainer = {
  ...globalStyles.flexBoxColumn,
  alignSelf: 'center',
  backgroundColor: globalColors.white,
  borderRadius: 5,
  boxShadow: `0 2px 5px 0 ${globalColors.black_20}`,
  position: 'relative',
  top: 10,
}

export default InviteByEmail
