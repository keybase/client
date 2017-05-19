// @flow
import React, {Component} from 'react'
import type {Props} from './confirm'
import {Box, Button, StandardScreen} from './'
import {globalStyles, globalColors} from '../styles'

class Confirm extends Component<void, Props, void> {
  render() {
    return (
      <StandardScreen
        style={styleContainer}
        styleOuter={{...backgroundColorThemed[this.props.theme]}}
        styleClose={styleCloseThemed[this.props.theme]}
        onClose={this.props.onCancel}
      >
        <Box style={styleIconContainer}>
          {this.props.header}
        </Box>
        {this.props.body}
        <Box style={{...globalStyles.flexBoxRow, marginTop: 32}}>
          <Button
            type="Secondary"
            style={cancelButtonThemed[this.props.theme]}
            labelStyle={cancelButtonLabelThemed[this.props.theme]}
            onClick={this.props.onCancel}
            label="Cancel"
          />
          <Button
            style={{marginLeft: 10}}
            type={this.props.danger ? 'Danger' : 'Primary'}
            onClick={this.props.onSubmit}
            label={this.props.submitLabel}
          />
        </Box>
      </StandardScreen>
    )
  }
}

const styleContainer = {
  maxWidth: 512,
}

const styleIconContainer = {
  ...globalStyles.flexBoxColumn,
  height: 80,
  marginBottom: 16,
  alignItems: 'center',
  justifyContent: 'center',
}

const backgroundColorThemed = {
  public: {
    backgroundColor: globalColors.white,
  },
  private: {
    backgroundColor: globalColors.darkBlue3,
  },
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

const styleCloseThemed = {
  public: {
    color: globalColors.black_20,
  },
  private: {
    color: globalColors.white_40,
  },
}

export default Confirm
