// @flow
import * as React from 'react'
import {Box, Button, ButtonBar} from '../../common-adapters'
import {FormInput} from '../../common-adapters/index.native'
import {globalMargins, globalStyles} from '../../styles'

import type {Props} from './render'

const EditProfileRender = (props: Props) => (
  <Box style={globalStyles.flexBoxColumn}>
    <FormInput
      autoCorrect={true}
      autoFocus={true}
      label="Full name"
      value={props.fullname}
      onChangeText={fullname => props.onFullnameChange(fullname)}
      hideBottomBorder={true}
    />
    <FormInput
      autoCorrect={true}
      label="Bio"
      value={props.bio}
      multiline={true}
      maxHeight={180}
      onChangeText={bio => props.onBioChange(bio)}
      hideBottomBorder={true}
    />
    <FormInput
      autoCorrect={true}
      label="Location"
      value={props.location}
      onEnterKeyDown={props.onSubmit}
      onChangeText={location => props.onLocationChange(location)}
    />
    <ButtonBar fullWidth={true}>
      <Button style={styleButton} type="Primary" onClick={props.onSubmit} label="Save" />
    </ButtonBar>
  </Box>
)

const styleButton = {
  marginTop: globalMargins.medium,
}

export default EditProfileRender
