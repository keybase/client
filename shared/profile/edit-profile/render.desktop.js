// @flow
import React, {Component} from 'react'
import {globalStyles, globalMargins} from '../../styles'
import {StandardScreen, Box, Button, Input} from '../../common-adapters'

import type {Props} from './render'

class EditProfileRender extends Component<void, Props, void> {
  render() {
    return (
      <StandardScreen onBack={this.props.onBack}>
        <Box style={styleContainer}>
          <Input
            autoFocus={true}
            style={styleEditProfile}
            hintText="Full name"
            value={this.props.fullname}
            onEnterKeyDown={this.props.onSubmit}
            onChangeText={fullname => this.props.onFullnameChange(fullname)}
          />
          <Input
            style={styleEditProfile}
            hintText="Location"
            value={this.props.location}
            onEnterKeyDown={this.props.onSubmit}
            onChangeText={location => this.props.onLocationChange(location)}
          />
          <Input
            style={styleEditProfile}
            hintText="Bio"
            value={this.props.bio}
            multiline={true}
            rowsMax={4}
            errorText={this.props.bioLengthLeft <= 5 ? this.props.bioLengthLeft + ' characters left.' : ''}
            onChangeText={bio => this.props.onBioChange(bio)}
          />
          <Box style={styleButtonContainer}>
            <Button
              type="Secondary"
              onClick={this.props.onCancel}
              label="Cancel"
              style={{marginRight: globalMargins.tiny}}
            />
            <Button type="Primary" onClick={this.props.onSubmit} label="Save" />
          </Box>
        </Box>
      </StandardScreen>
    )
  }
}

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
