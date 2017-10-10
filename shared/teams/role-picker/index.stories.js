// @flow
import * as React from 'react'
import {storiesOf, action} from '../../stories/storybook'
import {RoleConfirm, RoleOptions} from '.'

const commonProps = {
  onBack: action('onBack'),
  onComplete: action('onComplete'),
  teamname: 'keybase',
  username: 'ayoubd',
  allowOwner: true,
  setConfirm: action('setConfirm'),
  setSelectedRole: action('setSelectedRole'),
  setSendNotification: action('setSendNotification'),
  sendNotification: false,
  selectedRole: 'writer',
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
  storiesOf('Team Roles', module)
    .add('Picker', () => <RoleOptions {...roleOptionsProps} />)
    .add('ConfirmReader', () => <RoleConfirm {...roleConfirmProps} selectedRole="reader" />)
    .add('ConfirmWriter', () => <RoleConfirm {...roleConfirmProps} selectedRole="writer" />)
    .add('ConfirmAdmin', () => <RoleConfirm {...roleConfirmProps} selectedRole="admin" />)
    .add('ConfirmOwner', () => <RoleConfirm {...roleConfirmProps} selectedRole="owner" />)
}

export default load
