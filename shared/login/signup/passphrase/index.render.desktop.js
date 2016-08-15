// @flow
import Container from '../../forms/container'
import React, {Component} from 'react'
import type {Props} from './index.render'
import {UserCard, Input, Button} from '../../../common-adapters'
import {globalStyles, globalColors} from '../../../styles/style-guide'

class Render extends Component<void, Props, void> {

  render () {
    const passphraseError = this.props.passphraseError && this.props.passphraseError.stringValue()

    let confirmInput
    return (
      <Container onBack={this.props.onBack} style={stylesContainer} outerStyle={stylesOuter}>
        <UserCard style={stylesCard}>
          <Input autoFocus={true} style={stylesFirst} type='password'
            onChangeText={pass1 => this.props.pass1Update(pass1)}
            onEnterKeyDown={() => confirmInput.focus()}
            hintText='Create a passphrase' errorText={passphraseError} />
          <Input type='password' hintText='Confirm passphrase' onEnterKeyDown={this.props.onSubmit}
            ref={input => { confirmInput = input }}
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
