// @flow
import React from 'react'
import type {Props} from './render'
import {Button, Input, StandardScreen} from '../../common-adapters'
import {globalMargins} from '../../styles'

const EditProfileRender = (props: Props) => (
  <StandardScreen style={styleContainer} onClose={props.onBack}>
    <Input
      autoFocus={true}
      style={styleInput}
      floatingLabelText='Full name'
      hintText='Full name'
      value={props.fullname}
      onEnterKeyDown={props.onSubmit}
      onChangeText={fullname => props.onFullnameChange(fullname)} />
    <Input
      style={styleInput}
      floatingLabelText='Location'
      hintText='Location'
      value={props.location}
      onEnterKeyDown={props.onSubmit}
      onChangeText={location => props.onLocationChange(location)} />
    <Input
      style={styleInput}
      floatingLabelText='Bio'
      hintText='Bio'
      value={props.bio}
      multiline={true}
      rows={3}
      autoGrow={true}
      errorText={props.bioLengthLeft <= 5 ? props.bioLengthLeft + ' chars left' : ''}
      onEnterKeyDown={props.onSubmit}
      onChangeText={bio => props.onBioChange(bio)} />
    <Button
      style={styleButton}
      type='Primary'
      onClick={props.onSubmit}
      label='Save' />
  </StandardScreen>
)

const styleContainer = {
  marginTop: 0,
}

const styleInput = {
  marginTop: globalMargins.medium,
}

const styleButton = {
  marginTop: globalMargins.medium,
}

export default EditProfileRender
