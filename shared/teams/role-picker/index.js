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
import {type TeamRoleType} from '../../constants/teams'
import {globalColors, globalMargins, globalStyles} from '../../styles'
import {roleIconMap, roleDescMap, permissionMap} from './index.meta'

export type RolePickerProps = {
  confirm: boolean,
  username: string,
  selectedRole: TeamRoleType,
  allowOwner: boolean,
  sendNotification: boolean,
  teamname: string,
  setConfirm: (confirm: boolean) => void,
  setSelectedRole: (r: TeamRoleType) => void,
  setSendNotification: (send: boolean) => void,
  onComplete: (r: TeamRoleType, showNotification: boolean) => void,
  onBack: () => void,
}

// create row in rolepicker screen
const makeRoleOption = (role: TeamRoleType, selected: TeamRoleType, setSelected: TeamRoleType => void) => (
  <ClickableBox
    hoverColor={globalColors.black_05}
    style={{
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
      padding: globalMargins.tiny,
      paddingLeft: globalMargins.small,
      paddingRight: globalMargins.small,
    }}
    onClick={() => setSelected(role)}
  >
    <Icon
      type={(role && roleIconMap[role]) || 'iconfont-close'}
      style={{
        color: selected === role ? globalColors.blue : globalColors.black_40,
        fontSize: isMobile ? 32 : 28,
        marginRight: globalMargins.small,
      }}
    />
    <Box style={{...globalStyles.flexBoxColumn}}>
      <Text type="Header">{role}</Text>
      <Text type="BodySmallSemibold" style={{maxWidth: 200}}>
        {role && roleDescMap[role]}
      </Text>
    </Box>
    <Box style={{width: isMobile ? 32 : 28, marginLeft: globalMargins.small}}>
      {selected === role &&
        <Icon
          type="iconfont-check"
          style={{
            color: globalColors.blue,
            fontSize: isMobile ? 32 : 28,
            alignSelf: 'center',
          }}
        />}
    </Box>
  </ClickableBox>
)

// 1. Display roles for user to pick from
export const RoleOptions = ({
  username,
  selectedRole,
  setSelectedRole,
  allowOwner,
  setSendNotification,
  sendNotification,
  setConfirm,
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
      <Text type="Header">Select a role for {username}</Text>
    </Box>
    {makeRoleOption('reader', selectedRole, setSelectedRole)}
    {makeRoleOption('writer', selectedRole, setSelectedRole)}
    {makeRoleOption('admin', selectedRole, setSelectedRole)}
    {allowOwner && makeRoleOption('owner', selectedRole, setSelectedRole)}
    <Box style={{marginTop: globalMargins.small, marginBottom: globalMargins.small}}>
      <Checkbox label="Send chat notification" onCheck={setSendNotification} checked={sendNotification} />
    </Box>
    <Box style={{marginBottom: globalMargins.small}}>
      <Button label="Continue" type="Primary" onClick={() => setConfirm(true)} disabled={!selectedRole} />
    </Box>
  </Box>
)

// 2. Confirm screen with role permissions details
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

  // List item renderer
  const renderer = (can?: boolean) => (permission: string) => (
    <Box
      style={{
        ...globalStyles.flexBoxRow,
        alignItems: 'center',
        height: isMobile ? 32 : 24,
        padding: globalMargins.tiny,
      }}
    >
      <Icon
        type={can ? 'iconfont-check' : 'iconfont-close'}
        style={{color: can ? globalColors.green : globalColors.red, alignSelf: 'center'}}
      />
      <Text type="BodySemibold" style={{marginLeft: globalMargins.tiny}}>{permission}</Text>
    </Box>
  )

  // Hard-code lists to make height sizing simpler
  const cans = []
  const cannots = []
  permissions.can.forEach(perm => {
    cans.push(renderer(true)(perm))
  })
  permissions.cannot &&
    permissions.cannot.forEach(perm => {
      cannots.push(renderer(false)(perm))
    })

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
          size={isMobile ? 64 : 48}
        />
        <Icon
          type={roleIconMap[selectedRole] || 'iconfont-close'}
          style={{
            fontSize: isMobile ? 28 : 20,
            margin: globalMargins.tiny,
            alignSelf: 'center',
          }}
        />
        <Avatar
          style={{marginLeft: globalMargins.tiny, alignSelf: 'center'}}
          isTeam={true}
          teamname={teamname}
          size={isMobile ? 64 : 48}
        />
      </Box>
      <Box
        style={{
          margin: globalMargins.tiny,
          marginLeft: globalMargins.small,
          marginRight: globalMargins.small,
        }}
      >
        <Text type="BodyBig">Make {username} a {selectedRole} of {teamname}?</Text>
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
