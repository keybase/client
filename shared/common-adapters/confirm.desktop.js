// @flow
import React, {Component} from 'react'
import type {Props} from './confirm'
import Box from './box'
import Button from './button'
import StandardScreen from './standard-screen'
import {globalStyles, globalColors, globalMargins} from '../styles'

class Confirm extends Component<Props> {
  render() {
    return (
      <StandardScreen
        style={styleContainer}
        theme={mapTheme[this.props.theme]}
        onCancel={this.props.onCancel}
      >
        <Box style={styleIconContainer}>{this.props.header}</Box>
        {this.props.body}
        <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.medium}}>
          <Button
            type="Secondary"
            style={cancelButtonThemed[this.props.theme]}
            labelStyle={cancelButtonLabelThemed[this.props.theme]}
            onClick={this.props.onCancel}
            label="Cancel"
          />
          <Button
            style={{marginLeft: globalMargins.tiny}}
            type={this.props.danger ? 'Danger' : 'Primary'}
            onClick={this.props.onSubmit}
            label={this.props.submitLabel}
            disabled={this.props.disabled}
          />
        </Box>
      </StandardScreen>
    )
  }
}

const mapTheme = {
  private: 'dark',
  public: 'light',
}

const styleContainer = {
  maxWidth: 440,
}

const styleIconContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  height: 80,
  justifyContent: 'center',
  marginBottom: 16,
}

const cancelButtonThemed = {
  private: {
    backgroundColor: globalColors.blue_30,
  },
  public: {},
}

const cancelButtonLabelThemed = {
  private: {
    color: globalColors.white,
  },
  public: {},
}

export default Confirm
