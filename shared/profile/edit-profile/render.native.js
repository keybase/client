// @flow
import * as React from 'react'
import {Box, Button, Input, HeaderHoc, ButtonBar} from '../../common-adapters'
import {globalMargins} from '../../styles'

import type {Props} from './render'

const EditProfileRender = (props: Props) => (
  <Box>
    <Input
      autoCorrect={true}
      autoFocus={true}
      style={styleInput}
      floatingHintTextOverride="Full name"
      hintText="Full name"
      inForm={true}
      value={props.fullname}
      onEnterKeyDown={props.onSubmit}
      onChangeText={fullname => props.onFullnameChange(fullname)}
    />
    <Input
      autoCorrect={true}
      style={styleInput}
      floatingHintTextOverride="Bio"
      hintText="Bio"
      inForm={true}
      value={props.bio}
      multiline={true}
      rowsMin={1}
      rowsMax={3}
      errorText={props.bioLengthLeft <= 5 ? props.bioLengthLeft + ' characters left' : ''}
      onChangeText={bio => props.onBioChange(bio)}
    />
    <Input
      autoCorrect={true}
      style={styleInput}
      floatingHintTextOverride="Location"
      hintText="Location"
      inForm={true}
      value={props.location}
      onEnterKeyDown={props.onSubmit}
      onChangeText={location => props.onLocationChange(location)}
    />
    <ButtonBar fullWidth={true}>
      <Button style={styleButton} type="Primary" fullWidth={true} onClick={props.onSubmit} label="Save" />
    </ButtonBar>
  </Box>
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
