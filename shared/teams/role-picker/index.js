// @flow
import React from 'react'
import {
  Avatar,
  Box,
  ClickableBox,
  Button,
  HeaderHoc,
  PopupDialog,
  Text,
  Icon,
  ScrollView,
  Checkbox,
} from '../../common-adapters/index'
import {isMobile} from '../../constants/platform'
import {typeToLabel, isAdmin, isOwner} from '../../constants/teams'
import {type TeamRoleType} from '../../constants/types/teams'
import {globalColors, globalMargins, globalStyles} from '../../styles'
import {roleIconMap, roleIconColorMap, roleDescMap, permissionMap} from './index.meta'

export type RolePickerProps = {
  confirm: boolean,
  controlled?: boolean,
  currentType: ?TeamRoleType,
  username: string,
  selectedRole: TeamRoleType,
  allowAdmin?: boolean,
  allowOwner?: boolean,
  sendNotification: boolean,
  teamname: string,
  sendNotificationChecked?: boolean,
  showSendNotification: boolean,
  setConfirm: (confirm: boolean) => void,
  setSelectedRole: (r: TeamRoleType) => void,
  setSendNotification: (send: boolean) => void,
  onComplete: (r: TeamRoleType, showNotification: boolean) => void,
  onBack: () => void,
}

// create row in rolepicker screen
const makeRoleOption = (
  role: TeamRoleType,
  selected: TeamRoleType,
  setSelected: TeamRoleType => void,
  disabled?: boolean = false
) => (
  <ClickableBox
    hoverColor={globalColors.black_05}
    style={{
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
      backgroundColor: selected === role ? globalColors.blue : globalColors.white,
      padding: globalMargins.tiny,
      paddingLeft: globalMargins.tiny,
      paddingRight: globalMargins.tiny,
    }}
    onClick={() => setSelected(role)}
  >
    <Icon type="iconfont-check" style={{alignSelf: 'center', color: globalColors.white, fontSize: 24}} />
    <Box style={{...globalStyles.flexBoxColumn, paddingLeft: globalMargins.tiny}}>
      <Box style={globalStyles.flexBoxRow}>
        {!!roleIconMap[role] &&
          <Icon
            type={roleIconMap[role]}
            style={{
              color: roleIconColorMap[role],
              fontSize: 16,
              marginRight: globalMargins.tiny,
            }}
          />}
        <Text style={{color: selected === role ? globalColors.white : globalColors.black}} type="Header">
          {typeToLabel[role]}
        </Text>
      </Box>
      <Text
        style={{color: selected === role ? globalColors.white : globalColors.black_40, width: 267}}
        type="BodySmallSemibold"
      >
        {role && roleDescMap[role]}
      </Text>
    </Box>
  </ClickableBox>
)

// 1. Display roles for user to pick from
export const RoleOptions = ({
  controlled,
  currentType,
  username,
  selectedRole,
  setSelectedRole,
  allowAdmin = true,
  allowOwner = true,
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
      paddingTop: globalMargins.xtiny,
      paddingBottom: globalMargins.xtiny,
    }}
  >
    <Box style={{marginTop: globalMargins.small, marginBottom: globalMargins.small}}>
      <Text type="Header">
        {username ? `Select a role for ${username}` : 'Select a role'}
      </Text>
    </Box>
    {allowOwner && makeRoleOption('owner', selectedRole, setSelectedRole)}
    {allowAdmin && makeRoleOption('admin', selectedRole, setSelectedRole)}
    {makeRoleOption('writer', selectedRole, setSelectedRole)}
    {makeRoleOption('reader', selectedRole, setSelectedRole)}
    {showSendNotification &&
      <Box style={{marginTop: globalMargins.small, marginBottom: globalMargins.tiny}}>
        <Checkbox label="Send chat notification" onCheck={setSendNotification} checked={sendNotification} />
      </Box>}
    <Box style={{marginBottom: globalMargins.small, marginTop: globalMargins.tiny}}>
      <Button
        label={controlled ? 'Select' : 'Continue'}
        type="Primary"
        onClick={() => setConfirm(true)}
        disabled={selectedRole === currentType && sendNotificationChecked === sendNotification}
      />
    </Box>
  </Box>
)

// 2. Confirm screen with role permissions details
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
      style={{color: props.can ? globalColors.green : globalColors.red, alignSelf: 'center'}}
    />
    <Text type="BodySemibold" style={{marginLeft: globalMargins.tiny}}>{props.permission}</Text>
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
  const cans = (permissions.can || [])
    .map((perm, idx) => <PermissionRow key={idx} can={true} permission={perm} />)
  const cannots = (permissions.cannot || [])
    .map((perm, idx) => <PermissionRow key={idx} can={false} permission={perm} />)

  // Handle a / an
  const article = isOwner(selectedRole) || isAdmin(selectedRole) ? 'an' : 'a'
  const prompt = `Make ${username} ${article} ${selectedRole} of ${teamname}?`

  // Setup icon sizing
  const avatarSize = isMobile ? 64 : 48
  const iconSize = isMobile ? 28 : 20

  return (
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        alignItems: 'center',
        flex: 1,
        paddingTop: globalMargins.xtiny,
        paddingBottom: globalMargins.xtiny,
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
        <Icon
          type={roleIconMap[selectedRole] || 'iconfont-close'}
          style={{
            fontSize: iconSize,
            margin: globalMargins.tiny,
            alignSelf: 'center',
          }}
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
      {cannots.length > 0 &&
        <Box style={{...globalStyles.flexBoxRow, margin: globalMargins.tiny}}>
          <Text type="BodySemibold">They won't be able to:</Text>
        </Box>}
      {cannots.length > 0 && <Box style={{...globalStyles.flexBoxColumn, width: 280}}>{cannots}</Box>}
      <Box style={{...globalStyles.flexBoxRow, margin: globalMargins.small}}>
        <Button type="Secondary" label="Back" onClick={() => setConfirm(false)} />
        <Button
          label="Confirm"
          type="Primary"
          style={{marginLeft: globalMargins.tiny}}
          onClick={() => onComplete(selectedRole, sendNotification)}
          disabled={!selectedRole}
        />
      </Box>
    </Box>
  )
}

// Conglomerate role displays
export const RolePicker = (props: RolePickerProps) => (
  <ScrollView>
    {props.confirm ? <RoleConfirm {...props} /> : <RoleOptions {...props} />}
  </ScrollView>
)
const PopupWrapped = (props: RolePickerProps) => (
  <PopupDialog onClose={props.onBack}>
    <RolePicker {...props} />
  </PopupDialog>
)

export default (isMobile ? HeaderHoc(RolePicker) : PopupWrapped)
