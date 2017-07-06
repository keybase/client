// @flow
import React, {Component} from 'react'
import {Button, Box, Text, StandardScreen, Icon} from '../../common-adapters'
import {globalMargins, globalColors, globalStyles} from '../../styles'
import type {Props} from './prove-pgp-import'

class ProvePgpImport extends Component<void, Props, void> {
  render() {
    return (
      <StandardScreen onCancel={this.props.onCancel} style={styleContainer}>
        <Icon type="icon-pgp-key-import-48" />
        <Text style={styleHeader} type="Header">
          Import a PGP key
        </Text>
        <Text style={styleBody} type="Body">
          To upload your existing PGP key to Keybase, please run the following command from your terminal:
        </Text>
        <Box style={styleTerminal}>
          <Text type="TerminalComment"># import a key from gpg's key chain</Text>
          <Text type="Terminal">keybase pgp select</Text>
          <Text type="TerminalEmpty" />
          <Text type="TerminalComment"># import from stdin and send the public half to Keybase</Text>
          <Text type="Terminal">cat privkey.asc | keybase pgp import</Text>
          <Text type="TerminalEmpty" />
          <Text type="TerminalComment"># for more options</Text>
          <Text type="Terminal">keybase pgp help</Text>
        </Box>
        <Button
          style={styleCancelButton}
          type="Secondary"
          onClick={() => this.props.onCancel()}
          label={'Close'}
        />
      </StandardScreen>
    )
  }
}

const styleContainer = {
  maxWidth: 576,
  padding: globalMargins.medium,
  marginLeft: globalMargins.medium,
  marginRight: globalMargins.medium,
}

const styleHeader = {
  marginTop: globalMargins.medium,
}

const styleBody = {
  marginTop: globalMargins.small,
  marginBottom: globalMargins.small,
}

const styleCancelButton = {
  marginTop: globalMargins.medium,
}

const styleTerminal = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'stretch',
  backgroundColor: globalColors.midnightBlue,
  borderRadius: 4,
  boxSizing: 'content-box',
  color: globalColors.white,
  marginLeft: -globalMargins.medium,
  marginRight: -globalMargins.medium,
  padding: globalMargins.medium,
  textAlign: 'left',
  width: '100%',
}

export default ProvePgpImport
