// @flow
import React, {Component} from 'react'
import {Box, Button, Text} from './'
import {globalStyles, globalColors} from '../styles/style-guide'

import type {Props} from './confirm'

class Confirm extends Component<void, Props, void> {
  render () {
    return (
      <Box style={{...styleContainer, ...backgroundColorThemed[this.props.theme]}}>
        <Text type='BodyPrimaryLink' style={{...styleClose, ...styleCloseThemed[this.props.theme]}} onClick={this.props.onCancel}>Cancel</Text>
        <Box style={styleInnerContainer}>
          <Box style={styleIconContainer}>
            {this.props.header}
          </Box>
          <Box style={styleBodyContainer}>
            {this.props.body}
          </Box>
        </Box>
        <Button type={this.props.danger ? 'Danger' : 'Primary'} onClick={this.props.onSubmit} label={this.props.submitLabel} style={{...styleButton, marginBottom: 16}} />
        <Button type='Secondary' onClick={this.props.onCancel} label='Cancel' style={{...styleButton, ...cancelButtonThemed[this.props.theme]}} labelStyle={cancelButtonLabelThemed[this.props.theme]} />
      </Box>
    )
  }
}

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  padding: 16,
  flex: 1,
}

const styleInnerContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
}

const styleIconContainer = {
  ...globalStyles.flexBoxColumn,
  height: 112,
  marginBottom: 16,
  alignItems: 'center',
  justifyContent: 'center',
}

const styleBodyContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  marginLeft: 16,
  marginRight: 16,
  marginBottom: 16,
}

const backgroundColorThemed = {
  'public': {
    backgroundColor: globalColors.white,
  },
  'private': {
    backgroundColor: globalColors.darkBlue3,
  },
}

const styleButton = {
  alignSelf: 'stretch',
}

const cancelButtonThemed = {
  'public': {},
  'private': {
    backgroundColor: globalColors.blue_30,
  },
}

const cancelButtonLabelThemed = {
  'public': {},
  'private': {
    color: globalColors.white,
  },
}

const styleClose = {
  alignSelf: 'flex-start',
  marginTop: 7,
  marginBottom: 12,
}

const styleCloseThemed = {
  'public': {
    color: globalColors.blue,
  },
  'private': {
    color: globalColors.white,
  },
}

export default Confirm
