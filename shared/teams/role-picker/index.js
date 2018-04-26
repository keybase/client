// @flow
import React from 'react'
import {
  Avatar,
  Box,
  ClickableBox,
  Button,
  ButtonBar,
  HeaderHoc,
  PopupDialog,
  Text,
  Icon,
  ScrollView,
  Checkbox,
} from '../../common-adapters/index'
import {typeToLabel, isAdmin, isOwner} from '../../constants/teams'
import {type TeamRoleType} from '../../constants/types/teams'
import {globalColors, globalMargins, globalStyles, isMobile} from '../../styles'
import {roleIconMap, roleIconColorMap, roleDescMap, permissionMap} from './index.meta'
import {pluralize} from '../../util/string'

export type RolePickerProps = {
  confirm: boolean,
  controlled?: boolean,
  username: string,
  selectedRole: TeamRoleType,
  allowAdmin?: boolean,
  allowOwner?: boolean,
  pluralizeRoleName?: boolean,
  sendNotification: boolean,
  teamname: string,
  sendNotificationChecked?: boolean,
  showSendNotification: boolean,
  setConfirm: (confirm: boolean) => void,
  setSelectedRole: (r: TeamRoleType) => void,
  setSendNotification: (send: boolean) => void,
  onComplete: (r: TeamRoleType, showNotification: boolean) => void,
  onCancel: () => void,
}

// create row in rolepicker screen
const makeRoleOption = (
  role: TeamRoleType,
  selected: TeamRoleType,
  setSelected: TeamRoleType => void,
  pluralizeRoleName?: boolean = false,
  disabled?: boolean = false
) => (
  <ClickableBox
    hoverColor={globalColors.black_05}
    style={{
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
      backgroundColor: selected === role ? globalColors.blue : globalColors.white,
      width: '100%',
      borderRadius: 0,
      padding: globalMargins.tiny,
      paddingLeft: globalMargins.small,
      paddingRight: globalMargins.large,
    }}
    onClick={() => setSelected(role)}
  >
    <Icon type="iconfont-check" style={{alignSelf: 'center'}} color={globalColors.white} />
    <Box style={{...globalStyles.flexBoxColumn, paddingLeft: globalMargins.small}}>
      <Box style={globalStyles.flexBoxRow}>
        {!!roleIconMap[role] && (
          <Icon
            type={roleIconMap[role]}
            style={{
              marginRight: globalMargins.xtiny,
            }}
            color={selected === role ? globalColors.white : roleIconColorMap[role]}
            fontSize={16}
          />
        )}
        <Text style={{color: selected === role ? globalColors.white : globalColors.black_75}} type="BodyBig">
          {pluralizeRoleName ? pluralize(typeToLabel[role]) : typeToLabel[role]}
        </Text>
      </Box>
      <Text style={{color: selected === role ? globalColors.white : globalColors.black_40}} type="BodySmall">
        {role && roleDescMap[role]}
      </Text>
    </Box>
  </ClickableBox>
)

// 1. Display roles for user to pick from
export const RoleOptions = ({
  controlled,
  username,
  selectedRole,
  setSelectedRole,
  allowAdmin = true,
  allowOwner = true,
  pluralizeRoleName = false,
  setSendNotification,
  sendNotification,
  sendNotificationChecked,
  setConfirm,
  showSendNotification,
}: RolePickerProps) => (
  <Box
    style={{
      ...globalStyles.flexBoxColumn,
      alignItems: 'center',
      maxWidth: 400,
      paddingTop: globalMargins.small,
      paddingBottom: globalMargins.tiny,
    }}
  >
    <Box style={{marginTop: globalMargins.small, marginBottom: globalMargins.small}}>
      <Text type="Header">{username ? `Select a role for ${username}:` : 'Select a role:'}</Text>
    </Box>
    {allowOwner && makeRoleOption('owner', selectedRole, setSelectedRole, pluralizeRoleName)}
    {allowAdmin && makeRoleOption('admin', selectedRole, setSelectedRole, pluralizeRoleName)}
    {makeRoleOption('writer', selectedRole, setSelectedRole, pluralizeRoleName)}
    {makeRoleOption('reader', selectedRole, setSelectedRole, pluralizeRoleName)}
    {showSendNotification && (
      <Box style={{marginTop: globalMargins.small, marginBottom: globalMargins.tiny}}>
        <Checkbox label="Send chat notification" onCheck={setSendNotification} checked={sendNotification} />
      </Box>
    )}
    <Box style={{marginBottom: globalMargins.small, marginTop: globalMargins.tiny}}>
      <Button
        label={controlled ? 'Select' : 'Continue'}
        type="Primary"
        onClick={() => setConfirm(true)}
        disabled={!selectedRole}
      />
    </Box>
  </Box>
)

// 2. Confirm screen with role permission details
// Permission renderer
const PermissionRow = (props: {can: boolean, permission: string}) => (
  <Box
    style={{
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
      height: isMobile ? 32 : 24,
      padding: globalMargins.tiny,
    }}
  >
    <Icon
      type={props.can ? 'iconfont-check' : 'iconfont-close'}
      style={{alignSelf: 'center'}}
      color={props.can ? globalColors.green : globalColors.red}
    />
    <Text type="Body" style={{marginLeft: globalMargins.tiny}}>
      {props.permission}
    </Text>
  </Box>
)

export const RoleConfirm = ({
  username,
  onComplete,
  selectedRole,
  sendNotification,
  setConfirm,
  teamname,
}: RolePickerProps) => {
  const introText = selectedRole === 'owner' ? "They'll have full power on the team:" : "They'll be able to:"
  const permissions = permissionMap[selectedRole]

  // Hard-code lists to make height sizing simpler
  const cans = (permissions.can || []).map((perm, idx) => (
    <PermissionRow key={idx} can={true} permission={perm} />
  ))
  const cannots = (permissions.cannot || []).map((perm, idx) => (
    <PermissionRow key={idx} can={false} permission={perm} />
  ))

  // Handle a / an
  const article = isOwner(selectedRole) || isAdmin(selectedRole) ? 'an' : 'a'
  const prompt = `Make ${username} ${article} ${selectedRole} of ${teamname}?`

  // Setup icon sizing
  const avatarSize = isMobile ? 64 : 48

  return (
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        alignItems: 'center',
        paddingTop: globalMargins.xtiny,
        paddingBottom: globalMargins.xtiny,
        paddingLeft: globalMargins.medium,
        paddingRight: globalMargins.medium,
      }}
    >
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          margin: globalMargins.small,
        }}
      >
        <Avatar
          style={{marginRight: globalMargins.tiny, alignSelf: 'center'}}
          username={username}
          size={avatarSize}
        />
        <Avatar
          style={{marginLeft: globalMargins.tiny, alignSelf: 'center'}}
          isTeam={true}
          teamname={teamname}
          size={avatarSize}
        />
      </Box>
      <Box
        style={{
          margin: globalMargins.tiny,
          marginLeft: globalMargins.small,
          marginRight: globalMargins.small,
        }}
      >
        <Text type="BodyBig">{prompt}</Text>
      </Box>
      <Box style={{...globalStyles.flexBoxRow, margin: globalMargins.tiny}}>
        <Text type="BodySemibold">{introText}</Text>
      </Box>
      <Box style={{...globalStyles.flexBoxColumn, width: 280}}>{cans}</Box>
      {cannots.length > 0 && (
        <Box style={{...globalStyles.flexBoxRow, margin: globalMargins.tiny}}>
          <Text type="BodySemibold">They won't be able to:</Text>
        </Box>
      )}
      {cannots.length > 0 && <Box style={{...globalStyles.flexBoxColumn, width: 280}}>{cannots}</Box>}
      <ButtonBar>
        <Button type="Secondary" label="Back" onClick={() => setConfirm(false)} />
        <Button
          label="Confirm"
          type="Primary"
          onClick={() => onComplete(selectedRole, sendNotification)}
          disabled={!selectedRole}
        />
      </ButtonBar>
    </Box>
  )
}

// Conglomerate role displays
export const RolePicker = (props: RolePickerProps) => (
  <ScrollView>{props.confirm ? <RoleConfirm {...props} /> : <RoleOptions {...props} />}</ScrollView>
)
const PopupWrapped = (props: RolePickerProps) => (
  <PopupDialog onClose={props.onCancel}>
    <RolePicker {...props} />
  </PopupDialog>
)

export default (isMobile ? HeaderHoc(RolePicker) : PopupWrapped)
