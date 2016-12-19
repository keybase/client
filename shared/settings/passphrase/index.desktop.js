// @flow
import React from 'react'
import {globalMargins} from '../../styles'
import {Button, Checkbox, Input, StandardScreen, Text} from '../../common-adapters'

import type {Props} from './index'

function UpdatePassphrase (props: Props) {
  const inputType = props.showTyping ? 'passwordVisible' : 'password'
  const notification = props.error
    ? {message: props.error.message, type: 'error'}
    : props.hasPGPKeyOnServer ? {message: 'Note: changing your passphrase will delete your PGP key from Keybase, and you\'ll need to generate or upload one again.', type: 'error'} : null
  return (
    <StandardScreen
      onBack={props.onBack}
      notification={notification} >
      <Input
        hintText='New passphrase'
        value={props.newPassphrase}
        type={inputType}
        errorText={props.newPassphraseError}
        onChangeText={props.onChangeNewPassphrase}
        style={styleInput} />
      {!props.newPassphraseError && <Text
        type='BodySmall'
        style={stylePasswordNote} >
        (Minimum 12 characters)
      </Text>}
      <Input
        hintText='Confirm new passphrase'
        value={props.newPassphraseConfirm}
        type={inputType}
        errorText={props.newPassphraseConfirmError}
        onChangeText={props.onChangeNewPassphraseConfirm}
        style={styleInput} />
      <Checkbox
        label='Show typing'
        onCheck={props.onChangeShowPassphrase}
        checked={props.showTyping}
        style={{marginBottom: globalMargins.medium}} />
      <Button
        type='Primary'
        label='Save'
        disabled={!props.canSave}
        onClick={props.onSave}
        waiting={props.waitingForResponse} />
    </StandardScreen>
  )
}

const styleInput = {
  minWidth: 450,
  marginBottom: globalMargins.small,
}

const stylePasswordNote = {
  position: 'relative',
  top: -globalMargins.small,
  height: 0,  // don't offset next input by label height
}

export default UpdatePassphrase
