// @flow
import Container from '../../forms/container'
import React, {Component} from 'react'
import type {Props} from './index.render'
import {UserCard, Input, Button} from '../../../common-adapters'
import {globalColors} from '../../../styles/style-guide'

class Render extends Component<void, Props, void> {
  render () {
    const passphraseError = this.props.passphraseError && this.props.passphraseError.stringValue()

    return (
      <Container onBack={this.props.onBack} outerStyle={stylesOuter}>
        <UserCard style={stylesCard}>
          <Input autoFocus={true} style={stylesFirst} type='password'
            onChangeText={pass1 => this.props.pass1Update(pass1)}
            hintText='Create a passphrase' errorText={passphraseError} />
          <Input type='password' style={stylesSecond} hintText='Confirm passphrase' onEnterKeyDown={this.props.onSubmit}
            onChangeText={pass2 => this.props.pass2Update(pass2)} />
          <Button fullWidth={true} type='Primary' label='Continue' onClick={this.props.onSubmit} />
        </UserCard>
      </Container>
    )
  }
}

const stylesOuter = {
  backgroundColor: globalColors.black_10,
}

const stylesFirst = {
  marginTop: 100,
}

const stylesSecond = {
  marginTop: 55,
  marginBottom: 30,
}

const stylesCard = {
  alignItems: 'stretch',
}

export default Render
