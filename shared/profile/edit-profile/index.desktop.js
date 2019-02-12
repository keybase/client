// @flow
// // TODO deprecate
import * as React from 'react'
import {globalStyles} from '../../styles'
import {StandardScreen, Box, WaitingButton, Input, ButtonBar} from '../../common-adapters'
import type {Props} from '.'
import {waitingKey} from '../../constants/tracker2'

const EditProfileRender = (props: Props) => (
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
        hintText="Bio"
        value={props.bio}
        multiline={true}
        rowsMax={4}
        errorText={props.bioLengthLeft <= 5 ? props.bioLengthLeft + ' characters left.' : ''}
        onChangeText={bio => props.onBioChange(bio)}
      />
      <Input
        style={styleEditProfile}
        hintText="Location"
        value={props.location}
        onEnterKeyDown={props.onSubmit}
        onChangeText={location => props.onLocationChange(location)}
      />
      <ButtonBar>
        <WaitingButton
          onlyDisable={true}
          waitingKey={waitingKey}
          type="Secondary"
          onClick={props.onCancel}
          label="Cancel"
        />
        <WaitingButton
          waitingKey={waitingKey}
          type="Primary"
          disabled={props.bioLengthLeft < 0}
          onClick={props.onSubmit}
          label="Save"
        />
      </ButtonBar>
    </Box>
  </StandardScreen>
)

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
