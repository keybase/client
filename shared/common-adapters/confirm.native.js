// @flow
import React, {Component} from 'react'
import type {Props} from './confirm'
import {Box, Button, StandardScreen} from './'
import {globalStyles, globalColors} from '../styles'

class Confirm extends Component<void, Props, void> {
  render () {
    return (
      <StandardScreen styleOuter={backgroundColorThemed[this.props.theme]} styleClose={styleCloseThemed[this.props.theme]} onClose={this.props.onCancel}>
        <Box style={styleBodyContainer}>
          <Box style={styleIconContainer}>
            {this.props.header}
          </Box>
          {this.props.body}
        </Box>
        <Button type={this.props.danger ? 'Danger' : 'Primary'} onClick={this.props.onSubmit} label={this.props.submitLabel} style={{...styleButton, marginBottom: 16}} />
        <Button type='Secondary' onClick={this.props.onCancel} label='Cancel' style={{...styleButton, ...cancelButtonThemed[this.props.theme]}} labelStyle={cancelButtonLabelThemed[this.props.theme]} />
      </StandardScreen>
    )
  }
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
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
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

const styleCloseThemed = {
  'public': {
    color: globalColors.blue,
  },
  'private': {
    color: globalColors.white,
  },
}

export default Confirm
