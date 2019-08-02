import * as React from 'react'
import Password from '.'
import {action, storiesOf} from '../../stories/storybook'

const props = {
  errorMessage: null,
  hasPGPKeyOnServer: false,
  hasRandomPW: true,
  newPasswordConfirmError: '',
  newPasswordError: '',
  onCancel: action('onCancel'),
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
    .add('Normal', () => <Password {...props} />)
    .add('Normal - Change password', () => <Password {...props} hasRandomPW={false} />)
    .add('Normal - Has PGP on server', () => <Password {...props} hasPGPKeyOnServer={true} />)
    .add('Normal - Show Typing', () => <Password {...props} showTyping={true} />)
    .add('Error - New Password Requirements', () => (
      <Password {...props} newPasswordError={'Your new password must have minimum 12 characters.'} />
    ))
    .add('Error - New Password Mismatch', () => (
      <Password {...props} newPasswordConfirmError={'Password confirmation does not match.'} />
    ))
}

export default load
