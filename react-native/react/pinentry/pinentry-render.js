'use strict'
/* @flow */

import React, { Component } from '../base-react'
import { TextField, RaisedButton, Checkbox } from 'material-ui'

export default class PinentryRender extends Component {
  componentWillMount () {
    this.state = {
      passphrase: ''
    }
  }

  render () {
    return (
      <div>
        <p>{this.props.payload.prompt_text}</p>
        <TextField
          ref='passphrase'
          onChange={e => this.setState({passphrase: e.target.value})}
          floatingLabelText='Your passphrase'
          value={this.state.passphrase} />

        {Object.keys(this.props.payload.features).map((feature, index) => {
          console.log('feature is')
          console.log(this.props.payload.features[feature])
          return <Checkbox
            name={feature}
            value={feature}
            label={this.props.payload.features[feature].label}
            defaultChecked={this.props.payload.features[feature].value}
            style={{marginTop: 30}}
          />
        })}

        <RaisedButton style={{margin: 5}} onClick={() => this.props.onCancel()} label='Cancel' />

        <RaisedButton style={{margin: 5}} onClick={() => this.props.onSubmit(this.state.passphrase)} label='OK' />
      </div>
    )
  }
}

PinentryRender.propTypes = {
  onSubmit: React.PropTypes.func.isRequired,
  onCancel: React.PropTypes.func.isRequired,
  payload: React.PropTypes.object.isRequired
}
