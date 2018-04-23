// @flow
import Container from '../../forms/container'
import React, {Component} from 'react'
import {UserCard, Input, Button, ButtonBar} from '../../../common-adapters'
import {globalColors, globalMargins} from '../../../styles'
import type {Props} from '.'

class PassphraseRender extends Component<Props> {
  render() {
    const passphraseError = this.props.passphraseError && this.props.passphraseError.stringValue()

    return (
      <Container onBack={this.props.onBack} outerStyle={stylesOuter}>
        <UserCard style={stylesCard}>
          <Input
            autoFocus={true}
            type="password"
            onChangeText={pass1 => this.props.pass1Update(pass1)}
            hintText="Create a passphrase"
            uncontrolled={true}
            floatingHintTextOverride="Create a passphrase"
            errorText={passphraseError}
          />
          <Input
            type="password"
            style={stylesSecond}
            hintText="Confirm passphrase"
            uncontrolled={true}
            floatingHintTextOverride="Confirm passphrase"
            onEnterKeyDown={this.props.onSubmit}
            onChangeText={pass2 => this.props.pass2Update(pass2)}
          />
          <ButtonBar>
            <Button fullWidth={true} type="Primary" label="Continue" onClick={this.props.onSubmit} />
          </ButtonBar>
        </UserCard>
      </Container>
    )
  }
}

const stylesOuter = {
  backgroundColor: globalColors.white,
}

const stylesSecond = {
  marginTop: globalMargins.small,
  marginBottom: globalMargins.small,
}

const stylesCard = {
  alignItems: 'stretch',
}

export default PassphraseRender
