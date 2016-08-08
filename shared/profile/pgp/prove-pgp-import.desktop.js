// @flow
import React, {Component} from 'react'
import {Button, Terminal, Text, StandardScreen} from '../../common-adapters'
import {globalColors, globalMargins} from '../../styles/style-guide'
import PgpIcon from './pgp-icon'
import type {Props} from './prove-pgp-choice'

class ProvePgpChoice extends Component<void, Props, void> {
  render () {
    return (
      <StandardScreen onClose={this.props.onCancel}>
        <PgpIcon type='import' />
        <Text style={styleHeader} type='Header'>Import a PGP key</Text>
        <Text style={styleBody} type='Body'>To upload your existing PGP key to Keybase, please run the following command from your terminal:</Text>
        <Terminal style={styleTerminal}>
          <Text type='TerminalComment'>import a key from gpg's key chain</Text>
          <Text type='Terminal'>{`keybase pgp select`}</Text>
          <Text type='TerminalEmpty' />
          <Text type='TerminalComment'>import from stdin and send the public half to Keybase</Text>
          <Text type='Terminal'>{`cat privkey.asc | keybase pgp import`}</Text>
          <Text type='TerminalEmpty' />
          <Text type='TerminalComment'>for more options</Text>
          <Text type='Terminal'>{`keybase pgp help`}</Text>
        </Terminal>
        <Button style={styleCancelButton} type='Secondary' onClick={() => this.props.onCancel()} label={'Close'} />
      </StandardScreen>
    )
  }
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
  padding: 32,
  width: '100%',
  maxWidth: 576,
}

export default ProvePgpChoice
