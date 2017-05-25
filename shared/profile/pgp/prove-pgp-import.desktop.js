// @flow
import React, {Component} from 'react'
import {Button, Terminal, Text, StandardScreen, Icon} from '../../common-adapters'
import {globalMargins} from '../../styles'
import type {Props} from './prove-pgp-import'

class ProvePgpImport extends Component<void, Props, void> {
  render() {
    return (
      <StandardScreen onCancel={this.props.onCancel} style={styleContainer}>
        <Icon type="icon-pgp-key-import-48" />
        <Text style={styleHeader} type="Header">Import a PGP key</Text>
        <Text style={styleBody} type="Body">
          To upload your existing PGP key to Keybase, please run the following command from your terminal:
        </Text>
        <Terminal style={styleTerminal}>
          <Text type="TerminalComment"># import a key from gpg's key chain</Text>
          <Text type="Terminal">keybase pgp select</Text>
          <Text type="TerminalEmpty" />
          <Text type="TerminalComment"># import from stdin and send the public half to Keybase</Text>
          <Text type="Terminal">cat privkey.asc | keybase pgp import</Text>
          <Text type="TerminalEmpty" />
          <Text type="TerminalComment"># for more options</Text>
          <Text type="Terminal">keybase pgp help</Text>
        </Terminal>
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
  borderRadius: 4,
  textAlign: 'left',
  boxSizing: 'content-box',
  width: '100%',
  marginLeft: -globalMargins.medium,
  marginRight: -globalMargins.medium,
  padding: globalMargins.medium,
}

export default ProvePgpImport
