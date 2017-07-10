// @flow
import React, {Component} from 'react'
import {Box, Button, Header, Text} from '../common-adapters'
import {globalStyles, globalMargins} from '../styles'

export type Props = {
  onClose: () => void,
  onOk: () => void,
}

class PgpPurgeMessage extends Component<void, Props, void> {
  _toItalics(s: string) {
    return <Text type="BodySemiboldItalic">{s}</Text>
  }

  render() {
    return (
      <Box style={globalStyles.flexBoxColumn}>
        <Box>
          <Header icon={true} type="Default" title="" onClose={this.props.onClose || (() => {})} />
        </Box>
        <Box
          style={{...globalStyles.flexBoxColumn, margin: globalMargins.medium, marginTop: globalMargins.tiny}}
        >
          <Text style={{textAlign: 'center'}} type="Header">Policy change on passphrases</Text>
          <Text style={{marginTop: globalMargins.small}} type="Body">
            {`
              We've gotten lots of feedback that it's annoying as all hell to enter a Keybase passphrase
              after restarts and updates. The consensus is you can trust a device's storage to keep a secret
              that's`}
            {' '}
            {this._toItalics('specific')}
            {' '}
            {`to that device.  Passphrases stink, like passed gas, and are bloody painful, like passed stones.
            `}
          </Text>

          <Text style={{marginTop: globalMargins.small}} type="Body">
            {`
              Note, however: on this device you've got a PGP private key in Keybase's local keychain.
              Some people `}
            {' '}
            {this._toItalics('want')}
            {' '}
            {` to type a passphrase to unlock their PGP key, and this new policy would bypass that.
              If you're such a person, you can run the following command to remove your PGP private key. If you do it, you'll have to use GPG for your PGP operations.
            `}
          </Text>
          <Text style={{marginTop: globalMargins.small}} type="TerminalInline">keybase pgp purge</Text>
        </Box>
        <Button
          style={{
            marginRight: globalMargins.medium,
            marginBottom: globalMargins.small,
            alignSelf: 'flex-end',
          }}
          type="Primary"
          onClick={this.props.onOk}
          label="Ok, got it!"
        />
      </Box>
    )
  }
}

export default PgpPurgeMessage
