import * as React from 'react'
import * as Kb from '../common-adapters/index'
import {pluralize} from '../util/string'
import {RolePickerProps} from '.'
import {FloatingRolePicker, sendNotificationFooter} from '../teams/role-picker'

type Props = {
  rolePickerProps: RolePickerProps
  count: number
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
      confirmLabel={`Add as ${pluralize(props.rolePickerProps.selectedRole, props.count)}`}
      disabledRoles={props.rolePickerProps.disabledRoles}
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
