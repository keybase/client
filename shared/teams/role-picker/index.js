// @flow
import React from 'react'
import * as Kb from '../../common-adapters'
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
  <Kb.ClickableBox
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
    <Kb.Icon type="iconfont-check" style={{alignSelf: 'center'}} color={globalColors.white} />
    <Kb.Box style={{...globalStyles.flexBoxColumn, paddingLeft: globalMargins.small}}>
      <Kb.Box style={globalStyles.flexBoxRow}>
        {!!roleIconMap[role] && (
          <Kb.Icon
            type={roleIconMap[role]}
            style={{
              marginRight: globalMargins.xtiny,
            }}
            color={selected === role ? globalColors.white : roleIconColorMap[role]}
            fontSize={16}
          />
        )}
        <Kb.Text
          style={{color: selected === role ? globalColors.white : globalColors.black_75}}
          type="BodyBig"
        >
          {pluralizeRoleName ? pluralize(typeToLabel[role]) : typeToLabel[role]}
        </Kb.Text>
      </Kb.Box>
      <Kb.Text
        style={{color: selected === role ? globalColors.white : globalColors.black_50}}
        type="BodySmall"
      >
        {role && roleDescMap[role]}
      </Kb.Text>
    </Kb.Box>
  </Kb.ClickableBox>
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
  <Kb.Box style={styles.container}>
    <Kb.Box style={styles.headerBox}>
      <Kb.Text style={styles.headerTitle} type="BodySmallSemibold">
        {headerTitle || (username ? `Select a role for ${username}:` : 'Select a role:')}
      </Kb.Text>
    </Kb.Box>
    {allowOwner && makeRoleOption('owner', selectedRole, setSelectedRole, pluralizeRoleName)}
    {allowAdmin && makeRoleOption('admin', selectedRole, setSelectedRole, pluralizeRoleName)}
    {makeRoleOption('writer', selectedRole, setSelectedRole, pluralizeRoleName)}
    {makeRoleOption('reader', selectedRole, setSelectedRole, pluralizeRoleName)}
    {showSendNotification && (
      <Kb.Box style={{marginBottom: globalMargins.tiny, marginTop: globalMargins.small}}>
        <Kb.Checkbox
          label="Send chat notification"
          onCheck={setSendNotification}
          checked={sendNotification}
        />
      </Kb.Box>
    )}
    <Kb.Box style={{marginBottom: globalMargins.small, marginTop: globalMargins.tiny}}>
      <Kb.Button
        label={addButtonLabel || (controlled ? 'Select' : 'Continue')}
        type="Primary"
        onClick={() => setConfirm(true)}
        disabled={!selectedRole}
      />
    </Kb.Box>
  </Kb.Box>
)

// 2. Confirm screen with role permission details
// Permission renderer
const PermissionRow = (props: {can: boolean, permission: string}) => (
  <Kb.Box
    style={{
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
      height: isMobile ? 32 : 24,
      padding: globalMargins.tiny,
    }}
  >
    <Kb.Icon
      type={props.can ? 'iconfont-check' : 'iconfont-close'}
      style={{alignSelf: 'center'}}
      color={props.can ? globalColors.green : globalColors.red}
    />
    <Kb.Text type="Body" style={{marginLeft: globalMargins.tiny}}>
      {props.permission}
    </Kb.Text>
  </Kb.Box>
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
    <Kb.Box style={styles.confirmBox}>
      <Kb.Box style={styles.avatarBox}>
        <Kb.Avatar
          style={{
            alignSelf: 'center',
            marginRight: globalMargins.tiny,
          }}
          username={username}
          size={avatarSize}
        />
        <Kb.Avatar
          style={{alignSelf: 'center', marginLeft: globalMargins.tiny}}
          isTeam={true}
          teamname={teamname}
          size={avatarSize}
        />
      </Kb.Box>
      <Kb.Box style={styles.promptBox}>
        <Kb.Text type="BodyBig">{prompt}</Kb.Text>
      </Kb.Box>
      <Kb.Box style={{...globalStyles.flexBoxRow, margin: globalMargins.tiny}}>
        <Kb.Text type="BodySemibold">{introText}</Kb.Text>
      </Kb.Box>
      <Kb.Box style={{...globalStyles.flexBoxColumn, width: 280}}>{cans}</Kb.Box>
      {cannots.length > 0 && (
        <Kb.Box style={{...globalStyles.flexBoxRow, margin: globalMargins.tiny}}>
          <Kb.Text type="BodySemibold">They won't be able to:</Kb.Text>
        </Kb.Box>
      )}
      {cannots.length > 0 && <Kb.Box style={{...globalStyles.flexBoxColumn, width: 280}}>{cannots}</Kb.Box>}
      <Kb.ButtonBar>
        <Kb.Button type="Secondary" label="Back" onClick={() => setConfirm(false)} />
        <Kb.Button
          label="Confirm"
          type="Primary"
          onClick={() => onComplete(selectedRole, sendNotification)}
          disabled={!selectedRole}
        />
      </Kb.ButtonBar>
    </Kb.Box>
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
export const RolePicker = (props: RolePickerProps) =>
  props.confirm
    ? Kb.HeaderOrPopup(
        <Kb.ScrollView>
          <RoleConfirm {...props} />
        </Kb.ScrollView>
      )
    : Kb.OverlayParentHOC(<Kb.FloatingMenu {...props} />)

export default RolePicker
