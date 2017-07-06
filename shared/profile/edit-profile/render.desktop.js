// @flow
import React from 'react'
import {globalStyles, globalMargins} from '../../styles'
import {StandardScreen, Box, Button, Input} from '../../common-adapters'

import type {Props} from './render'

const EditProfileRender = (props: Props) =>
  <StandardScreen onBack={props.onBack}>
    <Box style={styleContainer}>
      <Input
        autoFocus={true}
        style={styleEditProfile}
        hintText="Full name"
        value={props.fullname}
        onEnterKeyDown={props.onSubmit}
        onChangeText={fullname => props.onFullnameChange(fullname)}
      />
      <Input
        style={styleEditProfile}
        hintText="Location"
        value={props.location}
        onEnterKeyDown={props.onSubmit}
        onChangeText={location => props.onLocationChange(location)}
      />
      <Input
        style={styleEditProfile}
        hintText="Bio"
        value={props.bio}
        multiline={true}
        rowsMax={4}
        errorText={props.bioLengthLeft <= 5 ? props.bioLengthLeft + ' characters left.' : ''}
        onChangeText={bio => props.onBioChange(bio)}
      />
      <Box style={styleButtonContainer}>
        <Button
          type="Secondary"
          onClick={props.onCancel}
          label="Cancel"
          style={{marginRight: globalMargins.tiny}}
        />
        <Button type="Primary" onClick={props.onSubmit} label="Save" />
      </Box>
    </Box>
  </StandardScreen>

const styleButtonContainer = {
  ...globalStyles.flexBoxRow,
  marginTop: 35,
}

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  flex: 1,
  marginTop: 35,
}

const styleEditProfile = {
  marginTop: 35,
  minWidth: 450,
}

export default EditProfileRender
