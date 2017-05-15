// @flow
import React, {Component} from 'react'
import type {Props} from './confirm'
import Box from './box'
import Button from './button'
import StandardScreen from './standard-screen'
import {globalStyles, globalColors, globalMargins} from '../styles'

class Confirm extends Component<void, Props, void> {
  render () {
    return (
      <StandardScreen theme={mapTheme[this.props.theme]} onCancel={this.props.onCancel}>
        <Box style={styleBodyContainer}>
          <Box style={styleIconContainer}>
            {this.props.header}
          </Box>
          {this.props.body}
          <Box style={{alignSelf: 'stretch', ...globalStyles.flexBoxColumn, justifyContent: 'flex-end', flex: 1, marginBottom: globalMargins.medium, marginTop: globalMargins.medium}}>
            <Button fullWidth={true} type={this.props.danger ? 'Danger' : 'Primary'} onClick={this.props.onSubmit} label={this.props.submitLabel} style={{...styleButton, marginBottom: globalMargins.small}} />
            <Button fullWidth={true} type='Secondary' onClick={this.props.onCancel} label='Cancel' style={{...styleButton, ...cancelButtonThemed[this.props.theme]}} labelStyle={cancelButtonLabelThemed[this.props.theme]} />
          </Box>
        </Box>
      </StandardScreen>
    )
  }
}

const mapTheme = {
  'private': 'dark',
  'public': 'light',
}

const styleIconContainer = {
  ...globalStyles.flexBoxColumn,
  height: 112,
  marginBottom: globalMargins.small,
  alignItems: 'center',
  justifyContent: 'center',
}

const styleBodyContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  marginLeft: globalMargins.small,
  marginRight: globalMargins.small,
  marginBottom: globalMargins.small,
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

export default Confirm
