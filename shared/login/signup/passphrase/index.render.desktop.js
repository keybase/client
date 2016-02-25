/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'
import {globalStyles} from '../../../styles/style-guide'
import {Text, Input, Button} from '../../../common-adapters'

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
      <div style={styles.form}>
        <Text style={styles.topMargin} type='Header'>Create your Passphrase (+12 Characters)</Text>
        <Input type='password' ref={r => (passphraseRef1 = r)} hintText='Passphrase' errorText={passphraseError}/>
        <Input type='password' ref={r => (passphraseRef2 = r)} hintText='Again'/>
        <Button type='Secondary' label='Next' onClick={checkPassphrase}/>
      </div>
    )
  }
}

const styles = {
  form: {
    ...globalStyles.flexBoxColumn,
    flex: 1
  },

  topMargin: {
    marginTop: 20
  }
}
