'use strict'
/* @flow */

import React, {Component, StyleSheet} from '../../../base-react'
import {TextField, RaisedButton} from 'material-ui'

export default class PaperKeyRender extends Component {
  constructor (props) {
    super(props)

    this.state = {
      paperKey: ''
    }
  }

  onSubmit () {
    this.props.onSubmit(this.state.paperKey)
  }

  render () {
    return (
      <div style={styles.container}>
        <h1>Register with a paper key</h1>
        <h2>Lorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsum Lorem ipsum </h2>
        <TextField
          style={{width: '100%'}}
          hintText='Enter your paper key'
          floatingLabelText='Paper Key'
          onEnterKeyDown={() => this.onSubmit()}
          ref='paperKey'
          onChange={() => this.setState({paperKey: this.refs.paperKey.getValue()})}
          value={this.state.paperKey}
        />
        <RaisedButton
          style={{alignSelf: 'flex-end', marginTop: 20}}
          label='Submit & Log in'
          primary
          onClick={() => this.onSubmit()}
          enabled={this.state.paperKey}
        />
      </div>
    )
  }
}

PaperKeyRender.propTypes = {
  onSubmit: React.PropTypes.func.isRequired
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch'
  }
})

