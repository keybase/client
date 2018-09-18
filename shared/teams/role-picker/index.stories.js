// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import {RoleConfirm, RoleOptions} from '.'

const commonProps = {
  onCancel: Sb.action('onCancel'),
  onComplete: Sb.action('onComplete'),
  teamname: 'keybase',
  username: 'ayoubd',
  allowOwner: true,
  setConfirm: Sb.action('setConfirm'),
  setSelectedRole: Sb.action('setSelectedRole'),
  setSendNotification: Sb.action('setSendNotification'),
  sendNotification: false,
  selectedRole: 'writer',
  showSendNotification: true,
}

const roleOptionsProps = {
  ...commonProps,
  confirm: false,
}

const roleConfirmProps = {
  ...commonProps,
  confirm: true,
}

const load = () => {
  Sb.storiesOf('Teams/Roles', module)
    .add('Picker', () => <RoleOptions {...roleOptionsProps} />)
    .add('ConfirmReader', () => <RoleConfirm {...roleConfirmProps} selectedRole="reader" />)
    .add('ConfirmWriter', () => <RoleConfirm {...roleConfirmProps} selectedRole="writer" />)
    .add('ConfirmAdmin', () => <RoleConfirm {...roleConfirmProps} selectedRole="admin" />)
    .add('ConfirmOwner', () => <RoleConfirm {...roleConfirmProps} selectedRole="owner" />)
}

export default load
