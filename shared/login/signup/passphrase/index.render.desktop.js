/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'
import {UserCard, Input, Button} from '../../../common-adapters'
import {globalStyles, globalColorsDZ2} from '../../../styles/style-guide'
import Container from '../../forms/container'

import type {Props} from './index.render'

export default class Render extends Component {
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
      <Container onBack={this.props.onBack} style={styles.container} outerStyle={styles.outer}>
        <UserCard style={styles.card}>
          <Input style={styles.first} dz2 type='password' ref={r => (passphraseRef1 = r)}
            hintText='Create a passphrase' errorText={passphraseError} />
          <Input dz2 type='password' ref={r => (passphraseRef2 = r)} hintText='Confirm passphrase' onEnterKeyDown={checkPassphrase}/>
          <Button dz2 fullWidth type='Secondary' label='Continue' onClick={checkPassphrase}/>
        </UserCard>
      </Container>
    )
  }
}

const styles = {
  outer: {
    backgroundColor: globalColorsDZ2.black10
  },
  container: {
    ...globalStyles.flexBoxColumn,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15
  },
  card: {
    paddingLeft: 30,
    paddingRight: 30
  },
  first: {
    marginTop: 35
  }
}
