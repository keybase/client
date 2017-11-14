// @flow
import * as React from 'react'
import {Box, Button, ClickableBox, Dropdown, Input, PopupDialog, Text} from '../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../styles'
import capitalize from 'lodash/capitalize'
import {isMobile} from '../../constants/platform'

import {teamRoleTypes, type TeamRoleType} from '../../constants/teams'

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
  onClose: () => void,
  onInvite: () => void,
  onInviteesChange: (invitees: string) => void,
  onOpenRolePicker: (currentSelectedRole: TeamRoleType, selectedRoleCallback: (TeamRoleType) => void) => void,
  onRoleChange: (role: TeamRoleType) => void,
  role: TeamRoleType,
}

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
    <Text type="Body">{capitalize(item)}</Text>
  </Box>
)

const _makeDropdownItems = () => teamRoleTypes.map(item => _makeDropdownItem(item))

const InviteByEmail = (props: Props) => (
  <MaybePopup onClose={props.onClose}>
    <Box style={{...globalStyles.flexBoxColumn}}>
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          alignItems: 'center',
          margin: globalMargins.medium,
        }}
      >
        {!isMobile && <Text style={styleInside} type="Header">Invite by email</Text>}
        <Box
          style={{
            ...(isMobile ? globalStyles.flexBoxColumn : globalStyles.flexBoxRow),
            alignItems: 'center',
            margin: globalMargins.tiny,
          }}
        >
          <Text style={{margin: globalMargins.tiny}} type="Body">
            Add these team members to {props.name} as:
          </Text>
          <ClickableBox
            onClick={() =>
              props.onOpenRolePicker(props.role, (selectedRole: TeamRoleType) =>
                props.onRoleChange(selectedRole)
              )}
          >
            <Dropdown
              items={_makeDropdownItems()}
              selected={_makeDropdownItem(props.role)}
              onChanged={(node: React.Node) => {
                // $FlowIssue doesn't understand key will be string
                const selectedRole: TeamRoleType = (node && node.key) || null
                props.onRoleChange(selectedRole)
              }}
            />
          </ClickableBox>
        </Box>
        <Text type="BodySmallSemibold" style={{alignSelf: 'flex-start'}}>
          Enter multiple email addresses, separated by commas
        </Text>
        <Box
          style={{
            border: `1px solid ${globalColors.black_40}`,
            marginBottom: globalMargins.small,
            width: '100%',
          }}
        >
          <Input
            autoFocus={true}
            multiline={true}
            hideUnderline={true}
            onChangeText={invitees => props.onInviteesChange(invitees)}
            rowsMin={3}
            rowsMax={8}
            style={styleInside}
            value={props.invitees}
            small={true}
            inputStyle={styleInput}
          />
        </Box>

        <Button label="Invite" onClick={props.onInvite} type="Primary" />
      </Box>
    </Box>
  </MaybePopup>
)

const styleInside = {
  padding: globalMargins.tiny,
  marginTop: 0,
  margonBottom: 0,
}

const styleInput = {
  fontSize: 13,
  fontWeight: 'normal',
  textAlign: 'left',
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
