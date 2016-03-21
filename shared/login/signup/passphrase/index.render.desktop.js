/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'
import {UserCard, Input, Button} from '../../../common-adapters'
import {globalStyles, globalColors} from '../../../styles/style-guide'
import Container from '../../forms/container'

import type {Props} from './index.render'

class Render extends Component {
  props: Props;

  render () {
    let passphraseRef1 = null
    let passphraseRef2 = null
    const checkPassphrase = () => {
      if (passphraseRef1 && passphraseRef2) {
        this.props.checkPassphrase(passphraseRef1.getValue(), passphraseRef2.getValue())
      } else {
        console.error('Null refs for passphrase fields')
      }
    }
    const passphraseError = this.props.passphraseError && this.props.passphraseError.stringValue()

    return (
      <Container onBack={this.props.onBack} style={stylesContainer} outerStyle={stylesOuter}>
        <UserCard style={stylesCard}>
          <Input autoFocus style={stylesFirst} type='password' ref={r => (passphraseRef1 = r)}
            hintText='Create a passphrase' errorText={passphraseError} />
          <Input type='password' ref={r => (passphraseRef2 = r)} hintText='Confirm passphrase' onEnterKeyDown={checkPassphrase}/>
          <Button fullWidth type='Primary' label='Continue' onClick={checkPassphrase}/>
        </UserCard>
      </Container>
    )
  }
}

const stylesOuter = {
  backgroundColor: globalColors.black10
}
const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: 15
}
const stylesFirst = {
  marginTop: 35
}

const stylesCard = {
  alignItems: 'stretch'
}

export default Render
