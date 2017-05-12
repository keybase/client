// @flow
import Container from '../../forms/container'
import React, {Component} from 'react'
import type {Props} from './index.render'
import {UserCard, Input, Button} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../styles'

class PassphraseRender extends Component<void, Props, void> {
  render() {
    const passphraseError =
      this.props.passphraseError && this.props.passphraseError.stringValue()

    let confirmInput
    return (
      <Container
        onBack={this.props.onBack}
        style={stylesContainer}
        outerStyle={stylesOuter}
      >
        <UserCard style={stylesCard}>
          <Input
            autoFocus={true}
            style={{...stylesInput, ...stylesFirst}}
            type="password"
            onChangeText={pass1 => this.props.pass1Update(pass1)}
            onEnterKeyDown={() => confirmInput.focus()}
            hintText="Create a passphrase"
            errorText={passphraseError}
          />
          <Input
            type="password"
            style={stylesInput}
            hintText="Confirm passphrase"
            onEnterKeyDown={this.props.onSubmit}
            ref={input => {
              confirmInput = input
            }}
            onChangeText={pass2 => this.props.pass2Update(pass2)}
          />
          <Button
            type="Primary"
            label="Continue"
            onClick={this.props.onSubmit}
            style={{alignSelf: 'center'}}
          />
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

const stylesInput = {
  marginBottom: globalMargins.large,
}

const stylesFirst = {
  marginTop: 35,
}

const stylesCard = {
  alignItems: 'stretch',
}

export default PassphraseRender
