/* @flow */

import React, {Component} from 'react'
import {UserCard, Input, Button} from '../../../common-adapters'
import {globalStyles, globalColors} from '../../../styles/style-guide'
import Container from '../../forms/container'

import type {Props} from './index.render'

class Render extends Component<void, Props, void> {

  render () {
    const passphraseError = this.props.passphraseError && this.props.passphraseError.stringValue()

    return (
      <Container onBack={this.props.onBack} style={stylesContainer} outerStyle={stylesOuter}>
        <UserCard style={stylesCard}>
          <Input autoFocus style={stylesFirst} type='password'
            onChangeText={pass1 => this.props.pass1Update(pass1)}
            hintText='Create a passphrase' errorText={passphraseError} />
          <Input type='password' hintText='Confirm passphrase' onEnterKeyDown={this.props.onSubmit}
            onChangeText={pass2 => this.props.pass2Update(pass2)} />
          <Button fullWidth type='Primary' label='Continue' onClick={this.props.onSubmit} />
        </UserCard>
      </Container>
    )
  }
}

const stylesOuter = {
  backgroundColor: globalColors.black_10,
}
const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: 15,
}
const stylesFirst = {
  marginTop: 35,
}

const stylesCard = {
  alignItems: 'stretch',
}

export default Render
