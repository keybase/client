// @flow
import React, {Component} from 'react'
import type {Props} from './confirm'
import {Box, Button, StandardScreen} from './'
import {globalStyles, globalColors, globalMargins} from '../styles'

class Confirm extends Component<void, Props, void> {
  render() {
    return (
      <StandardScreen
        style={styleContainer}
        theme={mapTheme[this.props.theme]}
        onCancel={this.props.onCancel}
      >
        <Box style={styleIconContainer}>
          {this.props.header}
        </Box>
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
            type={this.props.danger ? 'Danger' : 'Primary'}
            onClick={this.props.onSubmit}
            label={this.props.submitLabel}
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
  height: 80,
  marginBottom: 16,
  alignItems: 'center',
  justifyContent: 'center',
}

const cancelButtonThemed = {
  public: {},
  private: {
    backgroundColor: globalColors.blue_30,
  },
}

const cancelButtonLabelThemed = {
  public: {},
  private: {
    color: globalColors.white,
  },
}

export default Confirm
