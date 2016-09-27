// @flow
import React from 'react'
import {globalMargins} from '../../styles'
import {Button, Checkbox, Input, StandardScreen, Text} from '../../common-adapters'

import type {Props} from './index'

function UpdatePassphrase (props: Props) {
  const inputType = props.showTyping ? 'passwordVisible' : 'password'
  return (
    <StandardScreen
      onBack={props.onBack}
      notification={props.errorMessage ? {message: props.errorMessage, type: 'error'} : null}
    >
      <Input
        floatingLabelText='Current passphrase'
        value={props.currentPassphrase}
        type={inputType}
        onChangeText={props.onChangeCurrentPassphrase}
        style={styleInput}
      />
      <Input
        floatingLabelText='New passphrase'
        value={props.newPassphrase}
        type={inputType}
        errorText={props.newPassphraseError}
        onChangeText={props.onChangeNewPassphrase}
        style={styleInput}
      />
      {!props.newPassphraseError && <Text
        type='BodySmall'
        style={stylePasswordNote}
      >
        (Minimum 12 characters)
      </Text>}
      <Input
        floatingLabelText='Confirm new passphrase'
        value={props.newPassphraseConfirm}
        type={inputType}
        errorText={props.newPassphraseConfirmError}
        onChangeText={props.onChangeNewPassphraseConfirm}
        style={styleInput}
      />
      <Checkbox
        label='Show typing'
        onCheck={props.onChangeShowPassphrase}
        checked={props.showTyping}
        style={{marginBottom: globalMargins.medium}}
      />
      <Button
        type='Primary'
        label='Save'
        disabled={!props.canSave}
        onClick={props.onSave}
      />
      <Text
        onClick={props.onForgotPassphrase}
        link={true}
        type='BodyPrimaryLink'
        style={{marginTop: globalMargins.medium}}
      >
        Forgot passphrase?
      </Text>
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
