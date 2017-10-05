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

import type {TeamRole} from '../../constants/types/flow-types'

export type RolePickerProps = {
  username: string,
  selectedRole: TeamRole,
  allowOwner: boolean,
  sendNotification: boolean,
  setSelectedRole: (r: TeamRole) => void,
  setSendNotification: (send: boolean) => void,
  onComplete: (r: TeamRole, showNotification: boolean) => void,
  onBack: () => void,
}

const roleNameMap = ['none', 'reader', 'writer', 'admin', 'owner']

const roleDescMap = [
  '',
  'Can write in chats but read only in folders.',
  'Can create channels, and write and read in chats and folders.',
  'Can manage team members roles, create subteams and channels, and write and read in chats and folders.',
  'Gets all the admin rights + can delete team',
]

const roleIconMap = ['iconfont-close', 'iconfont-search', 'iconfont-edit', 'iconfont-crown', 'iconfont-crown']

const mapRoleToName = (role: TeamRole, multiple?: boolean): string => {
  const base = roleNameMap[role]
  return multiple ? base + 's' : base
}

const makeRoleOption = (role, selected, setSelected) => (
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
      type={roleIconMap[role]}
      style={{
        color: selected === role ? globalColors.blue : globalColors.black_40,
        fontSize: isMobile ? 32 : 28,
        marginRight: globalMargins.small,
      }}
    />
    <Box style={{...globalStyles.flexBoxColumn}}>
      <Text type="Header">{mapRoleToName(role)}</Text>
      <Text type="BodySmallSemibold" style={{maxWidth: 200}}>
        {roleDescMap[role]}
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
        {makeRoleOption(1, selectedRole, setSelectedRole)}
        {makeRoleOption(2, selectedRole, setSelectedRole)}
        {makeRoleOption(3, selectedRole, setSelectedRole)}
        {allowOwner && makeRoleOption(4, selectedRole, setSelectedRole)}
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
