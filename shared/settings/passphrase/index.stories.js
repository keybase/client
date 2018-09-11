// @flow
import * as React from 'react'
import Passphrase from '.'
import {action, storiesOf} from '../../stories/storybook'

const props = {
  canSave: true,
  errorMessage: null,
  hasPGPKeyOnServer: false,
  newPassphrase: 'open sesame',
  newPassphraseConfirm: 'open sesame',
  newPassphraseConfirmError: null,
  newPassphraseError: null,
  onBack: action('onBack'),
  onChangeNewPassphrase: action('onChangeNewPassphrase'),
  onChangeNewPassphraseConfirm: action('onChangeNewPassphraseConfirm'),
  onChangeShowPassphrase: action('onChangeShowPassphrase'),
  onSave: action('onSave'),
  onUpdatePGPSettings: action('onUpdatePGPSettings'),
  showTyping: false,
  waitingForResponse: false,
}

// TODO a lot of this seems like it doesn't work
const load = () => {
  storiesOf('Settings/Passphrase', module)
    .add('Normal - Empty', () => (
      <Passphrase {...props} newPassphrase={''} newPassphraseConfirm={''} canSave={false} />
    ))
    .add('Normal - Has PGP on server', () => (
      <Passphrase
        {...props}
        newPassphrase={''}
        newPassphraseConfirm={''}
        hasPGPKeyOnServer={true}
        canSave={false}
      />
    ))
    .add('Normal', () => <Passphrase {...props} />)
    .add('Normal - Show Typing', () => <Passphrase {...props} showTyping={true} />)
    .add('Error - Wrong Passphrase', () => (
      <Passphrase
        {...props}
        errorMessage={'Wrong current passphrase. Please try again.'}
        currentPassphrase={''}
        canSave={false}
      />
    ))
    .add('Error - New Passphrase Requirements', () => (
      <Passphrase
        {...props}
        newPassphraseError={'Your new passphrase must have minimum 12 characters.'}
        newPassphraseConfirm={''}
      />
    ))
    .add('Error - New Passphrase Mismatch', () => (
      <Passphrase {...props} newPassphraseConfirmError={'Passphrase confirmation does not match.'} />
    ))
}

export default load
