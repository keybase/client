// @flow
import * as React from 'react'
import Password from '.'
import {action, storiesOf} from '../../stories/storybook'

const props = {
  canSave: true,
  errorMessage: null,
  hasPGPKeyOnServer: false,
  heading: '',
  newPassword: 'open sesame',
  newPasswordConfirm: 'open sesame',
  newPasswordConfirmError: null,
  newPasswordError: null,
  onBack: action('onBack'),
  onChangeNewPassword: action('onChangeNewPassword'),
  onChangeNewPasswordConfirm: action('onChangeNewPasswordConfirm'),
  onChangeShowPassword: action('onChangeShowPassword'),
  onSave: action('onSave'),
  onUpdatePGPSettings: action('onUpdatePGPSettings'),
  showTyping: false,
  waitingForResponse: false,
}

// TODO a lot of this seems like it doesn't work
const load = () => {
  storiesOf('Settings/Password', module)
    .add('Normal - Empty', () => (
      <Password {...props} newPassword={''} newPasswordConfirm={''} canSave={false} />
    ))
    .add('Normal - Has PGP on server', () => (
      <Password
        {...props}
        newPassword={''}
        newPasswordConfirm={''}
        hasPGPKeyOnServer={true}
        canSave={false}
      />
    ))
    .add('Normal', () => <Password {...props} />)
    .add('Normal - Show Typing', () => <Password {...props} showTyping={true} />)
    .add('Error - Wrong Password', () => (
      <Password
        {...props}
        errorMessage={'Wrong current password. Please try again.'}
        currentPassword={''}
        canSave={false}
      />
    ))
    .add('Error - New Password Requirements', () => (
      <Password
        {...props}
        newPasswordError={'Your new password must have minimum 12 characters.'}
        newPasswordConfirm={''}
      />
    ))
    .add('Error - New Password Mismatch', () => (
      <Password {...props} newPasswordConfirmError={'Password confirmation does not match.'} />
    ))
}

export default load
