// @flow
import React from 'react'
import {
  Avatar,
  Box,
  ClickableBox,
  Button,
  ButtonBar,
  HeaderOrPopup,
  Text,
  Icon,
  ScrollView,
  Checkbox,
} from '../../common-adapters/index'
import {typeToLabel, isAdmin, isOwner} from '../../constants/teams'
import {type TeamRoleType} from '../../constants/types/teams'
import {globalColors, globalMargins, globalStyles, isMobile, styleSheetCreate} from '../../styles'
import {roleIconMap, roleIconColorMap, roleDescMap, permissionMap} from './index.meta'
import {pluralize} from '../../util/string'

export type RolePickerProps = {
  addButtonLabel?: string,
  confirm: boolean,
  controlled?: boolean,
  username: string,
  selectedRole: TeamRoleType,
  allowAdmin?: boolean,
  allowOwner?: boolean,
  headerTitle?: string,
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
      borderRadius: 0,
      padding: globalMargins.tiny,
      paddingLeft: globalMargins.small,
      paddingRight: globalMargins.large,
      width: '100%',
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
      <Text style={{color: selected === role ? globalColors.white : globalColors.black_50}} type="BodySmall">
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
  addButtonLabel,
  allowAdmin = true,
  allowOwner = true,
  headerTitle,
  pluralizeRoleName = false,
  setSendNotification,
  sendNotification,
  sendNotificationChecked,
  setConfirm,
  showSendNotification,
}: RolePickerProps) => (
  <Box style={styles.container}>
    <Box style={styles.headerBox}>
      <Text style={styles.headerTitle} type="BodySmallSemibold">
        {headerTitle || (username ? `Select a role for ${username}:` : 'Select a role:')}
      </Text>
    </Box>
    {allowOwner && makeRoleOption('owner', selectedRole, setSelectedRole, pluralizeRoleName)}
    {allowAdmin && makeRoleOption('admin', selectedRole, setSelectedRole, pluralizeRoleName)}
    {makeRoleOption('writer', selectedRole, setSelectedRole, pluralizeRoleName)}
    {makeRoleOption('reader', selectedRole, setSelectedRole, pluralizeRoleName)}
    {showSendNotification && (
      <Box style={{marginBottom: globalMargins.tiny, marginTop: globalMargins.small}}>
        <Checkbox label="Send chat notification" onCheck={setSendNotification} checked={sendNotification} />
      </Box>
    )}
    <Box style={{marginBottom: globalMargins.small, marginTop: globalMargins.tiny}}>
      <Button
        label={addButtonLabel || (controlled ? 'Select' : 'Continue')}
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
    <Box style={styles.confirmBox}>
      <Box style={styles.avatarBox}>
        <Avatar
          style={{
            alignSelf: 'center',
            marginRight: globalMargins.tiny,
          }}
          username={username}
          size={avatarSize}
        />
        <Avatar
          style={{alignSelf: 'center', marginLeft: globalMargins.tiny}}
          isTeam={true}
          teamname={teamname}
          size={avatarSize}
        />
      </Box>
      <Box style={styles.promptBox}>
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

const styles = styleSheetCreate({
  avatarBox: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    margin: globalMargins.small,
  },
  confirmBox: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    paddingBottom: globalMargins.xtiny,
    paddingLeft: globalMargins.medium,
    paddingRight: globalMargins.medium,
    paddingTop: globalMargins.xtiny,
  },
  container: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    maxWidth: 400,
    paddingBottom: globalMargins.tiny,
    paddingTop: globalMargins.small,
  },
  headerBox: {
    marginBottom: globalMargins.small,
    marginTop: globalMargins.small,
  },
  headerTitle: {
    color: globalColors.black_50,
  },
  promptBox: {
    margin: globalMargins.tiny,
    marginLeft: globalMargins.small,
    marginRight: globalMargins.small,
  },
})

// Conglomerate role displays
// $FlowIssue
export const RolePicker = (props: RolePickerProps) => (
  <ScrollView>{props.confirm ? <RoleConfirm {...props} /> : <RoleOptions {...props} />}</ScrollView>
)

export default HeaderOrPopup(RolePicker)
