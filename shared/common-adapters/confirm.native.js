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
      <StandardScreen theme={mapTheme[this.props.theme]} onCancel={this.props.onCancel}>
        <Box style={styleBodyContainer}>
          <Box style={styleIconContainer}>{this.props.header}</Box>
          {this.props.body}
          <Box
            style={{
              alignSelf: 'stretch',
              ...globalStyles.flexBoxColumn,
              flexGrow: 1,
              justifyContent: 'flex-end',
              marginBottom: globalMargins.medium,
              marginTop: globalMargins.medium,
            }}
          >
            <Button
              fullWidth={true}
              type={this.props.danger ? 'Danger' : 'Primary'}
              onClick={this.props.onSubmit}
              label={this.props.submitLabel}
              style={{...styleButton, marginBottom: globalMargins.small}}
            />
            <Button
              fullWidth={true}
              type="Secondary"
              onClick={this.props.onCancel}
              label="Cancel"
              style={{...styleButton, ...cancelButtonThemed[this.props.theme]}}
              labelStyle={cancelButtonLabelThemed[this.props.theme]}
              disabled={this.props.disabled}
            />
          </Box>
        </Box>
      </StandardScreen>
    )
  }
}

const mapTheme = {
  private: 'dark',
  public: 'light',
}

const styleIconContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  height: 112,
  justifyContent: 'center',
  marginBottom: globalMargins.small,
}

const styleBodyContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  flexGrow: 1,
  justifyContent: 'center',
  marginBottom: globalMargins.small,
  marginLeft: globalMargins.small,
  marginRight: globalMargins.small,
}

const styleButton = {
  alignSelf: 'stretch',
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
