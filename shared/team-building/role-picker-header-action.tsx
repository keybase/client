import * as React from 'react'
import * as Kb from '../common-adapters/index'
import * as Styles from '../styles'
import {RolePickerProps} from '.'
import {FloatingRolePicker, sendNotificationFooter} from '../teams/role-picker'

type Props = {
  rolePickerProps: RolePickerProps
  count: number
  onFinishTeamBuilding: () => void
}

const RolePickerHeaderAction = (props: Props) => {
  const [rolePickerOpen, setRolePickerOpen] = React.useState(
    (props.rolePickerProps && props.rolePickerProps.showRolePicker) || false
  )
  const onConfirm = role => {
    props.rolePickerProps.onSelectRole(role)
    setRolePickerOpen(false)
    props.onFinishTeamBuilding()
  }
  return (
    <FloatingRolePicker
      presetRole={props.rolePickerProps.selectedRole}
      open={rolePickerOpen}
      onConfirm={onConfirm}
      onCancel={() => setRolePickerOpen(false)}
      disabledRoles={props.rolePickerProps.disabledRoles}
      footerComponent={sendNotificationFooter(
        'Announce them in #general',
        props.rolePickerProps.sendNotification,
        props.rolePickerProps.changeSendNotification
      )}
    >
      <Kb.Text
        type="BodyBigLink"
        onClick={props.count ? () => setRolePickerOpen(true) : undefined}
        style={props.count ? undefined : styles.hide}
      >
        Add
      </Kb.Text>
    </FloatingRolePicker>
  )
}
export default RolePickerHeaderAction

const styles = Styles.styleSheetCreate(() => ({
  hide: {opacity: 0},
}))
