import * as React from 'react'
import * as Kb from '../common-adapters/index'
import {styles as headerStyles} from '../common-adapters/header-hoc'
import {RolePickerProps} from '.'
import {FloatingRolePicker, sendNotificationFooter} from '../teams/role-picker'

type Props = {
  rolePickerProps?: RolePickerProps
  onFinishTeamBuilding: () => void
}

export default (props: Props) => {
  const [rolePickerOpen, setRolePickerOpen] = React.useState(
    (props.rolePickerProps && props.rolePickerProps.showRolePicker) || false
  )
  return (
    <FloatingRolePicker
      open={rolePickerOpen}
      onConfirm={props.onFinishTeamBuilding}
      onSelectRole={props.rolePickerProps.onSelectRole}
      selectedRole={props.rolePickerProps.selectedRole}
      onCancel={() => setRolePickerOpen(false)}
      footerComponent={sendNotificationFooter(
        'Announce them in team chats',
        props.rolePickerProps.sendNotification,
        props.rolePickerProps.changeSendNotification
      )}
    >
      <Kb.Text type="BodyBigLink" onClick={() => setRolePickerOpen(true)}>
        Select role
      </Kb.Text>
    </FloatingRolePicker>
  )
}
