// @flow
import React, {Component} from 'react'
import {Box, Icon, Button} from './'
import {globalStyles, globalColors} from '../styles/style-guide'

import type {Props} from './confirm'

class Confirm extends Component<void, Props, void> {
  render () {
    return (
      <Box style={{...styleContainer, ...backgroundColorThemed[this.props.theme]}}>
        <Icon style={{...styleClose, ...styleCloseThemed[this.props.theme]}} type='fa-close' onClick={this.props.onCancel} />
        <Box style={styleIconContainer}>
          {this.props.header}
        </Box>
        {this.props.body}
        <Box style={{...globalStyles.flexBoxRow, marginTop: 32}}>
          <Button type='Secondary' style={cancelButtonThemed[this.props.theme]} labelStyle={cancelButtonLabelThemed[this.props.theme]} onClick={this.props.onCancel} label='Cancel' />
          <Button type={this.props.danger ? 'Danger' : 'Primary'} onClick={this.props.onSubmit} label={this.props.submitLabel} />
        </Box>
      </Box>
    )
  }
}

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  padding: 64,
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
}

const styleIconContainer = {
  ...globalStyles.flexBoxColumn,
  height: 80,
  marginBottom: 16,
  alignItems: 'center',
  justifyContent: 'center',
}

const backgroundColorThemed = {
  'public': {
    backgroundColor: globalColors.white,
  },
  'private': {
    backgroundColor: globalColors.darkBlue3,
  },
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
  ...globalStyles.clickable,
  position: 'absolute',
  right: 16,
  top: 16,
}

const styleCloseThemed = {
  'public': {
    color: globalColors.black_20,
  },
  'private': {
    color: globalColors.white_40,
  },
}

export default Confirm
