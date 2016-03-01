/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'
import {globalStyles} from '../../../styles/style-guide'
import {Text, Button} from '../../../common-adapters'

import type {Props} from './index.render'

export default class Render extends Component {
  props: Props;

  render () {
    return (
      <div style={styles.form}>
        <Text type='Header'>Ah Shoot! Something went wrong, wanna try again?</Text>
        <Text type='Body'>Error: {this.props.errorText.stringValue()}</Text>
        <Button type='Secondary' label='Try Again' onClick={() => this.props.resetSignup()}/>
      </div>
    )
  }
}

const styles = {
  form: {
    ...globalStyles.flexBoxColumn,
    flex: 1
  }
}
