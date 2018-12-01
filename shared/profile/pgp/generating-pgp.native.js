// @flow
import React, {Component} from 'react'
import {PlatformIcon, Text, StandardScreen, Icon} from '../../common-adapters'
import {globalMargins} from '../../styles'
import type {Props} from './generating-pgp'

class GeneratingPgp extends Component<Props> {
  render() {
    return (
      <StandardScreen onCancel={this.props.onCancel} style={styleContainer}>
        <PlatformIcon style={styleHeaderIcon} platform="pgp" overlay="icon-proof-unfinished" />
        <Text style={styleHeader} type="Header">
          Generating your unique key...
        </Text>
        <Text style={styleBody} type="Body">
          Math time! You are about to discover a 4096-bit key pair. This could take as long as a couple of
          minutes.
        </Text>
        <Icon style={styleLoadingIcon} type="icon-loader-infinity-64" />
      </StandardScreen>
    )
  }
}

const styleContainer = {
  justifyContent: 'flex-start',
}

const styleHeaderIcon = {
  alignSelf: 'center',
  marginTop: globalMargins.xtiny,
}

const styleHeader = {
  marginTop: globalMargins.small,
  textAlign: 'center',
}

const styleBody = {
  marginTop: globalMargins.xtiny,
  textAlign: 'center',
}

const styleLoadingIcon = {
  alignSelf: 'center',
  marginTop: globalMargins.medium,
}

export default GeneratingPgp
