'use strict'
/* @flow */

import React, { Component } from '../base-react'
import { TextField, RaisedButton, Checkbox } from 'material-ui'

export default class PinentryRender extends Component {
  componentWillMount () {
    this.state = {
      passphrase: ''
    }
    for (const feature in this.props.payload.features) {
      if (this.props.payload.features[feature].hasOwnProperty('value')) {
        this.state[feature] = this.props.payload.features[feature].value
      } else {
        console.error('We were passed a payload with no value!')
      }
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

        {Object.keys(this.props.payload.features).map((feature, _) => {
          return <Checkbox
            key={feature}
            name={feature}
            value={feature}
            label={this.props.payload.features[feature].label}
            defaultChecked={this.props.payload.features[feature].value}
            style={{marginTop: 30}}
            onCheck={(_, checked) => { this.state[feature] = checked }}
          />
        })}

        <RaisedButton style={{margin: 5}} onClick={() => this.props.onCancel()} label='Cancel' />

        <RaisedButton style={{margin: 5}} onClick={() => this.props.onSubmit(this.state)} label='OK' />
      </div>
    )
  }
}

PinentryRender.propTypes = {
  onSubmit: React.PropTypes.func.isRequired,
  onCancel: React.PropTypes.func.isRequired,
  payload: React.PropTypes.object.isRequired
}
