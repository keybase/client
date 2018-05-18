// @flow
import * as React from 'react'
import {Box, Button, StandardScreen} from './'
import {globalStyles, globalColors, globalMargins} from '../styles'

type Props = {
  theme: 'public' | 'private',
  danger?: boolean,
  submitLabel: string,
  onCancel: () => void,
  onSubmit: ?() => void,
  header: React.Node,
  body: React.Node,
  disabled?: boolean,
}

class Confirm extends React.Component<Props> {
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
