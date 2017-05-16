// @flow
import React, {Component} from 'react'
import {PlatformIcon, Text, StandardScreen, Icon} from '../../common-adapters'
import {globalMargins} from '../../styles'
import type {Props} from './generating-pgp'

class GeneratingPgp extends Component<void, Props, void> {
  render() {
    return (
      <StandardScreen onClose={this.props.onCancel} style={styleContainer}>
        <PlatformIcon style={styleHeaderIcon} platform="pgp" overlay="icon-proof-unfinished" />
        <Text style={styleHeader} type="Header">Generating your unique key...</Text>
        <Text style={styleBody} type="Body">
          Math time! You are about to discover a 4096-bit key pair. This could take as long as a couple minutes.
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
  marginTop: globalMargins.xtiny,
  alignSelf: 'center',
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
  marginTop: globalMargins.medium,
  alignSelf: 'center',
}

export default GeneratingPgp
