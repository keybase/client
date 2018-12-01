// @flow
import React, {Component} from 'react'
import {PlatformIcon, Button, Text, StandardScreen, Icon} from '../../common-adapters'
import {globalMargins} from '../../styles'
import type {Props} from './generating-pgp'

class GeneratingPgp extends Component<Props> {
  render() {
    return (
      <StandardScreen onCancel={this.props.onCancel} style={styleContainer}>
        <PlatformIcon platform="pgp" overlay="icon-proof-unfinished" />
        <Text style={styleHeader} type="Header">
          Generating your unique key...
        </Text>
        <Text style={styleBody} type="Body">
          Math time! You are about to discover a 4096-bit key pair.
          <br />
          This could take as long as a couple of minutes.
        </Text>
        <Icon type="icon-loader-infinity-64" />
        <Button
          style={styleCancelButton}
          type="Secondary"
          onClick={() => this.props.onCancel()}
          label={'Cancel'}
        />
      </StandardScreen>
    )
  }
}

const styleContainer = {
  maxWidth: 512,
}

const styleHeader = {
  marginTop: globalMargins.medium,
}

const styleBody = {
  marginBottom: globalMargins.large,
  marginTop: globalMargins.small,
}

const styleCancelButton = {
  marginTop: globalMargins.large,
}

export default GeneratingPgp
