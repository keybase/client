// @flow
import React from 'react'
import {
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
import {globalColors, globalMargins, globalStyles} from '../../styles'

import type {Role} from './container'

export type RolePickerProps = {
  username: string,
  selectedRole: Role,
  allowOwner: boolean,
  sendNotification: boolean,
  setSelectedRole: (r: Role) => void,
  setSendNotification: (send: boolean) => void,
  onComplete: (r: Role, showNotification: boolean) => void,
  onBack: () => void,
}

const roleDescMap = {
  null: '',
  reader: 'Can write in chats but read only in folders.',
  writer: 'Can create channels, and write and read in chats and folders.',
  admin: 'Can manage team members roles, create subteams and channels, and write and read in chats and folders.',
  owner: 'Gets all the admin rights + can delete team.',
}

const roleIconMap = {
  reader: 'iconfont-search',
  writer: 'iconfont-edit',
  admin: 'iconfont-crown',
  owner: 'iconfont-crown',
}

const makeRoleOption = (role: Role, selected: Role, setSelected: Role => void) => (
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

// Conglomerate role displays and add clickers etc.
export const RolePicker = (props: RolePickerProps) => {
  const {
    selectedRole,
    sendNotification,
    setSendNotification,
    setSelectedRole,
    allowOwner,
    onComplete,
    username,
  } = props
  return (
    <ScrollView>
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
          <Button
            label="Confirm"
            type="Primary"
            onClick={() => onComplete(selectedRole, sendNotification)}
            disabled={selectedRole === 0}
          />
        </Box>
      </Box>
    </ScrollView>
  )
}

const PopupWrapped = (props: RolePickerProps) => (
  <PopupDialog onClose={props.onBack}>
    <RolePicker {...props} />
  </PopupDialog>
)

export default (isMobile ? HeaderHoc(RolePicker) : PopupWrapped)
